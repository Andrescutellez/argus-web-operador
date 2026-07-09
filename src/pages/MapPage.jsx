/**
 * @fileoverview Mapa operacional — MapLibre GL JS, tema sincronizado con la app.
 *
 * PROPÓSITO:
 *   Dashboard cartográfico del operador: flota completa en tiempo real superpuesta
 *   sobre los cuadrantes de Bogotá. Usa los mismos estilos de mapa que argus-web-usuario
 *   (PALETTE_DAY / PALETTE_NIGHT) y sigue automáticamente el tema claro/oscuro activo.
 *
 * CAPAS DEL MAPA (apiladas de abajo hacia arriba):
 *   1. Base MapLibre — Argus Día/Noche (openfreemap bright + paleta propia) o Satélite
 *   2. GeoJSON — cuadrantes policiales (toggle, verde policial semitransparente)
 *   3. GeoJSON — mapa de riesgo por hurtos de motos 2026 (toggle, color por quintil)
 *   4. Marcadores HTML — flota en tiempo real (pulso animado por estado)
 *
 * SINCRONÍA DE TEMA:
 *   Estilo "Sistema" (default): dark → PALETTE_NIGHT, light → PALETTE_DAY.
 *   El picker permite fijar Argus Día, Argus Noche o Satélite manualmente.
 *
 * POSICIONES GPS INICIALES:
 *   Al cargar la flota, se hace GET /api/gps/:deviceId/latest para cada dispositivo
 *   en paralelo. Las actualizaciones en tiempo real llegan por socket gps:update.
 *
 * VARIABLES DE ESTADO:
 *   selectedStyle   — entrada de MAP_STYLES activa (default: Sistema)
 *   cuadrantesData  — GeoJSON FeatureCollection (null hasta que carga)
 *   showCuadrantes  — visibilidad de la capa de cuadrantes
 *   showCrime       — visibilidad de la capa de riesgo
 *   selectedCuad    — properties del cuadrante clickeado
 *   riskAlerts      — alertas ARI activas (hasta 5, auto-dismiss 12 s)
 *
 * VARIABLES CRÍTICAS (refs):
 *   mapRef            — instancia maplibregl.Map (null hasta init async)
 *   styleReadyRef     — true solo después de style.load; evita addSource prematura
 *   markersRef        — Map<deviceId, {marker, popup}> para gestión imperativa
 *   cuadrantesDataRef — espejo ref de cuadrantesData (accesible en callbacks ML)
 *   cuadClickRef      — handler estable click cuadrante (único, off+on al re-estilizar)
 *
 * @module pages/MapPage
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useStore } from '../store/useStore.js'
import {
  getFleet, getLatestGps, getGisCuadrantes, getGisNear, getCrimeBogota,
} from '../api/apiService.js'
import { connect, disconnect } from '../api/realtimeService.js'
import {
  buildArgusStyle, SATELLITE_STYLE, COLOMBIA_CENTER, MAP_STYLES,
} from '../lib/mapConfig.js'

// ─── Constantes ────────────────────────────────────────────────────────────────

const POLICE_GREEN = '#7FFF00'

const FAB = {
  width: 40, height: 40, borderRadius: 10,
  background: 'rgba(15,21,32,0.90)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.09)',
  color: '#CDD9E5',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  transition: 'background 0.15s, border 0.15s, color 0.15s',
}

// Expresiones MapLibre data-driven para la capa de riesgo (reemplaza el style() por feature)
const CRIME_FILL_COLOR = [
  'case',
  ['<=', ['coalesce', ['get', 'motos_2026'], 0], 0],  'rgba(255,255,255,0.03)',
  ['<=', ['get', 'motos_2026'], 15],                  'rgba(63,185,80,0.14)',
  ['<=', ['get', 'motos_2026'], 40],                  'rgba(210,153,34,0.18)',
  ['<=', ['get', 'motos_2026'], 70],                  'rgba(240,136,62,0.24)',
  ['<=', ['get', 'motos_2026'], 120],                 'rgba(229,72,77,0.28)',
  'rgba(139,92,246,0.32)',
]

const CRIME_LINE_COLOR = [
  'case',
  ['<=', ['coalesce', ['get', 'motos_2026'], 0], 0],  '#484F58',
  ['<=', ['get', 'motos_2026'], 15],                  '#3FB950',
  ['<=', ['get', 'motos_2026'], 40],                  '#D29922',
  ['<=', ['get', 'motos_2026'], 70],                  '#F0883E',
  ['<=', ['get', 'motos_2026'], 120],                 '#E5484D',
  '#8B5CF6',
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function crimeRiskLabel(motos) {
  if (!motos || motos === 0) return { label: 'Sin datos', color: '#484F58' }
  if (motos <= 15)  return { label: 'Muy bajo', color: '#3FB950' }
  if (motos <= 40)  return { label: 'Bajo',      color: '#D29922' }
  if (motos <= 70)  return { label: 'Moderado',  color: '#F0883E' }
  if (motos <= 120) return { label: 'Alto',       color: '#E5484D' }
  return                   { label: 'Muy alto',  color: '#8B5CF6' }
}

/**
 * Resuelve una entrada MAP_STYLES + el tema actual a un style.json MapLibre listo.
 * - Sistema → PALETTE_NIGHT (dark) o PALETTE_DAY (light)
 * - Satélite → SATELLITE_STYLE (sin fetch)
 * - Día/Noche → buildArgusStyle con su paleta fija
 */
async function resolveStyle(styleEntry, theme) {
  if (styleEntry.id === 'satellite') return SATELLITE_STYLE
  if (styleEntry.sistema) {
    const base = theme === 'dark' ? MAP_STYLES[2] : MAP_STYLES[1]
    return buildArgusStyle(base.url, base.palette)
  }
  return buildArgusStyle(styleEntry.url, styleEntry.palette)
}

/** Crea el elemento DOM del marcador para un dispositivo de la flota. */
function makeMarkerEl(connected, armed) {
  const el = document.createElement('div')
  const outerColor = armed ? 'rgba(229,72,77,0.3)'  : connected ? 'rgba(47,129,247,0.25)' : 'rgba(72,79,88,0.2)'
  const ringColor  = armed ? 'rgba(229,72,77,0.55)' : connected ? 'rgba(47,129,247,0.5)'  : 'rgba(72,79,88,0.35)'
  const dotColor   = armed ? '#E5484D'              : connected ? '#2F81F7'               : '#484F58'
  const pulse      = connected || armed
  el.style.cssText = 'position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;cursor:pointer;'
  el.innerHTML = `
    ${pulse ? `<div style="position:absolute;width:52px;height:52px;border-radius:50%;background:${outerColor};animation:argus-pulse 2s ease-out infinite;"></div>` : ''}
    <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:${ringColor};"></div>
    <div style="position:relative;width:26px;height:26px;border-radius:50%;background:${dotColor};display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.4);">🏍️</div>
  `
  return el
}

/** HTML del popup de un dispositivo (estilo oscuro Argus). */
function makePopupHtml(d) {
  const lastSeen = d.lastSeen
    ? new Date(d.lastSeen).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null
  return `
    <div style="min-width:170px;line-height:1.7;font-family:inherit;">
      <div style="font-weight:700;font-size:13px;margin-bottom:4px">${d.alias ?? d.deviceId}</div>
      <div style="font-size:11px;color:#8B949E">
        ${d.email ? `<div>${d.email}</div>` : ''}
        <div style="font-family:monospace">${d.deviceId}</div>
        <div style="margin-top:4px">Plan: <strong>${d.plan ?? '—'}</strong></div>
        <div>Estado: <strong style="color:${d.connected ? '#3FB950' : '#484F58'}">${d.connected ? '🟢 Online' : '⚫ Offline'}</strong></div>
        <div>Velocidad: <strong>${d.speed ?? 0} km/h</strong></div>
        ${lastSeen ? `<div style="font-size:10px;margin-top:2px">${lastSeen}</div>` : ''}
      </div>
    </div>
  `
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function MapPage() {
  const { fleet, setFleet, updateDevice } = useStore()
  const theme = useStore(s => s.theme)

  const devicesWithPos = fleet.filter(d => d.lat && d.lon)
  const online = fleet.filter(d => d.connected).length
  const armed  = fleet.filter(d => d.armed).length

  const [selectedStyle,   setSelectedStyle]   = useState(MAP_STYLES[0]) // Sistema
  const [showStylePicker, setShowStylePicker] = useState(false)
  const [cuadrantesData,  setCuadrantesData]  = useState(null)
  const [cuadLoading,     setCuadLoading]     = useState(true)
  const [showCuadrantes,  setShowCuadrantes]  = useState(true)
  const [selectedCuad,    setSelectedCuad]    = useState(null)
  const [showCrime,       setShowCrime]       = useState(false)
  const [crimeData,       setCrimeData]       = useState(null)
  const [selectedCrime,   setSelectedCrime]   = useState(null)
  const [riskAlerts,      setRiskAlerts]      = useState([])
  const riskTimerRef = useRef({})

  // Refs del mapa
  const containerRef      = useRef(null)
  const mapRef            = useRef(null)
  const styleReadyRef     = useRef(false)
  const markersRef        = useRef(new Map()) // deviceId → { marker, popup }

  // Refs de datos — accesibles en callbacks de MapLibre sin cierre antiguo
  const cuadrantesDataRef = useRef(null)
  const crimeDataRef      = useRef(null)
  const showCuadrantesRef = useRef(true)
  const showCrimeRef      = useRef(false)

  // Refs de handlers de eventos — estables para .off().on() sin duplicados
  const cuadClickRef  = useRef(null)
  const cuadEnterRef  = useRef(null)
  const cuadLeaveRef  = useRef(null)
  const crimeClickRef = useRef(null)
  const crimeEnterRef = useRef(null)
  const crimeLeaveRef = useRef(null)

  // Inicializar handlers una sola vez (en el primer render)
  if (!cuadClickRef.current) {
    cuadClickRef.current = (e) => {
      const f = e.features?.[0]
      if (!f) return
      setSelectedCuad(f.properties)
      // Buscar teléfono del CAI más cercano al centroide del polígono
      const ring = f.geometry?.type === 'Polygon'
        ? f.geometry.coordinates[0]
        : f.geometry?.coordinates?.[0]?.[0]
      if (ring?.length) {
        const centLon = ring.reduce((s, c) => s + c[0], 0) / ring.length
        const centLat = ring.reduce((s, c) => s + c[1], 0) / ring.length
        getGisNear(centLon, centLat, 'cai', 1)
          .then(({ data }) => {
            if (data?.[0]?.telefono) {
              setSelectedCuad(prev => prev ? { ...prev, telefono: data[0].telefono } : prev)
            }
          })
          .catch(() => {})
      }
    }
    cuadEnterRef.current  = () => mapRef.current?.setPaintProperty('cuadrantes-fill', 'fill-opacity', 0.28)
    cuadLeaveRef.current  = () => mapRef.current?.setPaintProperty('cuadrantes-fill', 'fill-opacity', 0.13)
    crimeClickRef.current = (e) => { const f = e.features?.[0]; if (f) setSelectedCrime(f.properties) }
    crimeEnterRef.current = () => mapRef.current?.setPaintProperty('crime-fill', 'fill-opacity', 0.55)
    crimeLeaveRef.current = () => mapRef.current?.setPaintProperty('crime-fill', 'fill-opacity', 1)
  }

  // ─── _addCrimeLayer — añade fuente + capas de riesgo al mapa ─────────────

  const _addCrimeLayer = useCallback((map) => {
    if (!map || map.getSource('crime') || !crimeDataRef.current) return
    map.addSource('crime', { type: 'geojson', data: crimeDataRef.current })
    map.addLayer({
      id: 'crime-fill', type: 'fill', source: 'crime',
      paint: { 'fill-color': CRIME_FILL_COLOR, 'fill-opacity': 1 },
    })
    map.addLayer({
      id: 'crime-outline', type: 'line', source: 'crime',
      paint: { 'line-color': CRIME_LINE_COLOR, 'line-width': 1, 'line-opacity': 0.7 },
    })
    map.off('mouseenter', 'crime-fill', crimeEnterRef.current)
    map.on('mouseenter',  'crime-fill', crimeEnterRef.current)
    map.off('mouseleave', 'crime-fill', crimeLeaveRef.current)
    map.on('mouseleave',  'crime-fill', crimeLeaveRef.current)
    map.off('click', 'crime-fill', crimeClickRef.current)
    map.on('click',  'crime-fill', crimeClickRef.current)
  }, []) // solo lee refs estables

  // ─── addCustomLayers — llamado en cada style.load ─────────────────────────

  const addCustomLayers = useCallback((map) => {
    if (!map) return

    if (cuadrantesDataRef.current) {
      if (!map.getSource('cuadrantes')) {
        map.addSource('cuadrantes', { type: 'geojson', data: cuadrantesDataRef.current })
      }
      if (!map.getLayer('cuadrantes-fill')) {
        map.addLayer({
          id: 'cuadrantes-fill', type: 'fill', source: 'cuadrantes',
          paint: { 'fill-color': POLICE_GREEN, 'fill-opacity': 0.13 },
          layout: { visibility: showCuadrantesRef.current ? 'visible' : 'none' },
        })
      }
      if (!map.getLayer('cuadrantes-outline')) {
        map.addLayer({
          id: 'cuadrantes-outline', type: 'line', source: 'cuadrantes',
          paint: { 'line-color': POLICE_GREEN, 'line-width': 1.8, 'line-opacity': 0.85 },
          layout: { visibility: showCuadrantesRef.current ? 'visible' : 'none' },
        })
      }
      map.off('mouseenter', 'cuadrantes-fill', cuadEnterRef.current)
      map.on('mouseenter',  'cuadrantes-fill', cuadEnterRef.current)
      map.off('mouseleave', 'cuadrantes-fill', cuadLeaveRef.current)
      map.on('mouseleave',  'cuadrantes-fill', cuadLeaveRef.current)
      map.off('click', 'cuadrantes-fill', cuadClickRef.current)
      map.on('click',  'cuadrantes-fill', cuadClickRef.current)
    }

    if (crimeDataRef.current && showCrimeRef.current) {
      _addCrimeLayer(map)
    }
  }, [_addCrimeLayer])

  // ─── 1. Inicialización del mapa (una sola vez) ────────────────────────────

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let alive = true

    resolveStyle(MAP_STYLES[0], theme).then(style => {
      if (!alive || !containerRef.current) return
      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: COLOMBIA_CENTER,
        zoom: 12,
        attributionControl: false,
      })
      mapRef.current = map

      map.on('style.load', () => {
        styleReadyRef.current = true
        addCustomLayers(map)
      })
    })

    return () => {
      alive = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        styleReadyRef.current = false
      }
      markersRef.current.forEach(({ marker }) => marker.remove())
      markersRef.current.clear()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 2. Cambio de tema o estilo manual ───────────────────────────────────

  const skipFirstStyleRef = useRef(true)
  useEffect(() => {
    // Omitir el primer render — el mapa ya se inicializó con el tema actual
    if (skipFirstStyleRef.current) { skipFirstStyleRef.current = false; return }
    if (!mapRef.current) return
    let cancelled = false
    resolveStyle(selectedStyle, theme).then(style => {
      if (cancelled || !mapRef.current) return
      styleReadyRef.current = false
      mapRef.current.setStyle(style)
    })
    return () => { cancelled = true }
  }, [theme, selectedStyle]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 3. Toggle visibilidad cuadrantes ────────────────────────────────────

  useEffect(() => {
    showCuadrantesRef.current = showCuadrantes
    const map = mapRef.current
    if (!map || !styleReadyRef.current) return
    const vis = showCuadrantes ? 'visible' : 'none'
    if (map.getLayer('cuadrantes-fill'))    map.setLayoutProperty('cuadrantes-fill',    'visibility', vis)
    if (map.getLayer('cuadrantes-outline')) map.setLayoutProperty('cuadrantes-outline', 'visibility', vis)
  }, [showCuadrantes])

  // ─── 4. Toggle visibilidad crimen ────────────────────────────────────────

  useEffect(() => {
    showCrimeRef.current = showCrime
    const map = mapRef.current
    if (!map || !styleReadyRef.current) return
    if (showCrime && crimeDataRef.current) {
      if (!map.getSource('crime')) {
        _addCrimeLayer(map)
      } else {
        map.setLayoutProperty('crime-fill',    'visibility', 'visible')
        map.setLayoutProperty('crime-outline', 'visibility', 'visible')
      }
    } else if (!showCrime && map.getLayer('crime-fill')) {
      map.setLayoutProperty('crime-fill',    'visibility', 'none')
      map.setLayoutProperty('crime-outline', 'visibility', 'none')
    }
  }, [showCrime, _addCrimeLayer])

  // ─── 5. Carga de datos de crimen al activar el toggle ────────────────────

  useEffect(() => {
    if (!showCrime || crimeData) return
    getCrimeBogota()
      .then(({ data }) => {
        crimeDataRef.current = data
        setCrimeData(data)
        const map = mapRef.current
        if (map && styleReadyRef.current && !map.getSource('crime')) {
          _addCrimeLayer(map)
        }
      })
      .catch(() => {})
  }, [showCrime, _addCrimeLayer]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 6. Actualización de marcadores de flota ─────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const currentIds = new Set(fleet.map(d => d.deviceId))

    // Eliminar marcadores de dispositivos que ya no están en flota
    markersRef.current.forEach(({ marker }, id) => {
      if (!currentIds.has(id)) { marker.remove(); markersRef.current.delete(id) }
    })

    fleet.forEach(d => {
      if (!d.lat || !d.lon) return
      const existing = markersRef.current.get(d.deviceId)
      if (existing) {
        existing.marker.setLngLat([d.lon, d.lat])
        existing.popup.setHTML(makePopupHtml(d))
        // Actualizar color del marcador (estado online/armed puede cambiar)
        const newEl = makeMarkerEl(d.connected, d.armed)
        existing.marker.getElement().innerHTML = newEl.innerHTML
      } else {
        const el     = makeMarkerEl(d.connected, d.armed)
        const popup  = new maplibregl.Popup({ offset: 25, closeButton: true }).setHTML(makePopupHtml(d))
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([d.lon, d.lat])
          .setPopup(popup)
          .addTo(map)
        markersRef.current.set(d.deviceId, { marker, popup })
      }
    })
  }, [fleet])

  // ─── 7. Carga inicial de flota + posiciones GPS + cuadrantes + socket ────

  useEffect(() => {
    const fetchGpsForFleet = (devices) => {
      devices.forEach(d => {
        if (d.lat && d.lon) return // ya tiene posición
        getLatestGps(d.deviceId)
          .then(({ data: gps }) => {
            if (gps?.lat && gps?.lon) updateDevice(d.deviceId, { lat: gps.lat, lon: gps.lon, speed: gps.speed })
          })
          .catch(() => {})
      })
    }

    if (fleet.length === 0) {
      getFleet()
        .then(({ data }) => { setFleet(data); fetchGpsForFleet(data) })
        .catch(() => {})
    } else {
      fetchGpsForFleet(fleet)
    }

    getGisCuadrantes()
      .then(({ data }) => {
        cuadrantesDataRef.current = data
        setCuadrantesData(data)
        const map = mapRef.current
        if (map && styleReadyRef.current && !map.getSource('cuadrantes')) {
          addCustomLayers(map)
        }
      })
      .catch(() => {})
      .finally(() => setCuadLoading(false))

    connect(
      data => updateDevice(data.deviceId, { lat: data.lat, lon: data.lon, speed: data.speed, connected: true }),
      () => {},
      null,
      (alert) => {
        setRiskAlerts(prev => [{ ...alert, id: Date.now() }, ...prev].slice(0, 5))
        clearTimeout(riskTimerRef.current[alert.deviceId])
        riskTimerRef.current[alert.deviceId] = setTimeout(() => {
          setRiskAlerts(prev => prev.filter(a => a.deviceId !== alert.deviceId || a.event !== alert.event))
        }, 12_000)
      },
    )

    return () => disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Centrar mapa en la flota ─────────────────────────────────────────────

  const handleFitBounds = () => {
    const map = mapRef.current
    if (!map) return
    if (devicesWithPos.length === 0) {
      map.flyTo({ center: COLOMBIA_CENTER, zoom: 11 })
      return
    }
    const bounds = devicesWithPos.reduce(
      (b, d) => b.extend([d.lon, d.lat]),
      new maplibregl.LngLatBounds(
        [devicesWithPos[0].lon, devicesWithPos[0].lat],
        [devicesWithPos[0].lon, devicesWithPos[0].lat],
      ),
    )
    map.fitBounds(bounds, { padding: 80 })
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>

      <style>{`
        @keyframes argus-pulse { 0%{transform:scale(0.8);opacity:0.8} 70%{transform:scale(1.6);opacity:0} 100%{transform:scale(1.6);opacity:0} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .maplibregl-canvas { outline: none; }
        .maplibregl-popup-content {
          background: rgba(8,12,18,0.95) !important;
          border: 1px solid rgba(255,255,255,0.10) !important;
          border-radius: 10px !important;
          color: #CDD9E5 !important;
          padding: 12px 14px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
          font-family: 'Sora', sans-serif;
        }
        .maplibregl-popup-anchor-bottom .maplibregl-popup-tip { border-top-color: rgba(8,12,18,0.95) !important; }
        .maplibregl-popup-close-button { color: #8B949E !important; font-size: 16px !important; right: 8px !important; top: 6px !important; background: none !important; }
        .maplibregl-popup-close-button:hover { color: #CDD9E5 !important; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        background: 'var(--card)', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text1)' }}>
            Mapa operacional
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text2)' }}>
            {devicesWithPos.length} con GPS · {online} en línea
            {armed > 0 && <span style={{ color: 'var(--armed)', marginLeft: 6 }}>· {armed} armados</span>}
            {cuadrantesData && (
              <span style={{ color: 'var(--text3)', marginLeft: 8 }}>
                · {cuadrantesData.features.length} cuadrantes
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text2)' }}>
          <LegendDot color="var(--blue)"  label="Online" />
          <LegendDot color="var(--armed)" label="Armado" />
          <LegendDot color="var(--text3)" label="Offline" />
          <StatusBadge online={online} total={fleet.length} />
        </div>
      </div>

      {/* ── Contenedor del mapa ─────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative' }}>

        {/* Alertas ARI — dispositivos que entran/salen de zonas de riesgo */}
        {riskAlerts.length > 0 && (
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 1001, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 300, maxWidth: 380,
          }}>
            {riskAlerts.map(alert => (
              <div
                key={alert.id}
                onClick={() => setRiskAlerts(prev => prev.filter(a => a.id !== alert.id))}
                style={{
                  background: 'rgba(8,12,18,0.92)', backdropFilter: 'blur(12px)',
                  border: `1.5px solid ${alert.event === 'enter' ? 'rgba(229,72,77,0.5)' : 'rgba(63,185,80,0.5)'}`,
                  borderRadius: 12, padding: '8px 14px',
                  display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 18 }}>{alert.event === 'enter' ? '⚠️' : '✅'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: alert.event === 'enter' ? '#E5484D' : '#3FB950' }}>
                    {alert.deviceId} · {alert.event === 'enter' ? `Riesgo alto ARI ${alert.ari}` : 'Zona segura'}
                  </div>
                  <div style={{ fontSize: 9, color: '#8B949E' }}>
                    {alert.event === 'enter'
                      ? `Vigilancia reforzada activada en ${alert.localidad}`
                      : `Sensibilidad normal restaurada en ${alert.localidad}`}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: '#484F58' }}>×</span>
              </div>
            ))}
          </div>
        )}

        {/* Canvas MapLibre */}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* ── FABs — columna derecha ─────────────────────────────────── */}
        <div style={{
          position: 'absolute', right: 16, top: 16, zIndex: 1000,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <button
            onClick={() => setShowStylePicker(p => !p)}
            title="Estilo de mapa"
            style={{
              ...FAB,
              background: showStylePicker ? 'rgba(255,107,53,0.18)' : FAB.background,
              border:     showStylePicker ? '1px solid rgba(255,107,53,0.45)' : FAB.border,
              color:      showStylePicker ? '#FF6B35' : '#CDD9E5',
            }}
          >
            <span style={{ fontSize: 18 }}>{selectedStyle.icon}</span>
          </button>

          <button
            onClick={() => setShowCuadrantes(s => !s)}
            title={showCuadrantes ? 'Ocultar cuadrantes' : 'Mostrar cuadrantes'}
            style={{
              ...FAB,
              background: showCuadrantes ? 'rgba(47,129,247,0.15)' : FAB.background,
              border:     showCuadrantes ? '1px solid rgba(47,129,247,0.4)' : FAB.border,
              color:      showCuadrantes ? '#2F81F7' : '#484F58',
            }}
          >
            {cuadLoading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <polyline points="2 17 12 22 22 17"/>
                <polyline points="2 12 12 17 22 12"/>
              </svg>
            )}
          </button>

          <button onClick={handleFitBounds} title="Centrar mapa" style={FAB}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/>
              <line x1="12" y1="2"  x2="12" y2="7"/>
              <line x1="12" y1="17" x2="12" y2="22"/>
              <line x1="2"  y1="12" x2="7"  y2="12"/>
              <line x1="17" y1="12" x2="22" y2="12"/>
            </svg>
          </button>

          <button
            onClick={() => { setShowCrime(c => !c); setSelectedCrime(null) }}
            title={showCrime ? 'Ocultar mapa de riesgo' : 'Mostrar mapa de riesgo'}
            style={{
              ...FAB,
              background: showCrime ? 'rgba(229,72,77,0.15)' : FAB.background,
              border:     showCrime ? '1px solid rgba(229,72,77,0.4)' : FAB.border,
              color:      showCrime ? '#E5484D' : '#484F58',
            }}
          >
            ⚠️
          </button>
        </div>

        {/* ── Panel riesgo crimen — esquina inferior derecha ─────────── */}
        {showCrime && crimeData && (
          <div style={{
            position: 'absolute', bottom: 24, right: 16, zIndex: 1000,
            background: 'rgba(8,12,18,0.92)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderLeft: '3px solid #E5484D',
            borderRadius: 14, padding: '12px 16px', minWidth: 220, maxWidth: 260,
          }}>
            <div style={{ fontSize: 9, color: '#484F58', letterSpacing: '0.8px', marginBottom: 8 }}>
              HURTOS MOTOS 2026 · BOGOTÁ
            </div>
            {[...crimeData.features]
              .filter(f => f.properties.motos_2026 > 0)
              .sort((a, b) => b.properties.motos_2026 - a.properties.motos_2026)
              .slice(0, 5)
              .map(f => {
                const p = f.properties
                const { color } = crimeRiskLabel(p.motos_2026)
                const maxVal = crimeData.features.reduce((m, x) => Math.max(m, x.properties.motos_2026 || 0), 0)
                const pct = maxVal > 0 ? (p.motos_2026 / maxVal) * 100 : 0
                return (
                  <div key={p.codigo} onClick={() => setSelectedCrime(p)} style={{ marginBottom: 6, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 10, color: selectedCrime?.codigo === p.codigo ? color : '#CDD9E5', fontWeight: 600 }}>
                        {p.nombre}
                      </span>
                      <span style={{ fontSize: 10, color, fontWeight: 700 }}>{p.motos_2026}</span>
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }}>
                      <div style={{ height: 3, width: `${pct}%`, background: color, borderRadius: 2 }} />
                    </div>
                  </div>
                )
              })}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 8, paddingTop: 6 }}>
              <div style={{ fontSize: 8, color: '#484F58', letterSpacing: '0.5px' }}>
                TOTAL: <span style={{ color: '#8B949E', fontWeight: 600 }}>{crimeData.meta?.total_motos ?? '—'} hurtos</span>
              </div>
            </div>
            {selectedCrime && (
              <div style={{
                marginTop: 8, padding: '8px 10px', borderRadius: 8,
                background: 'rgba(229,72,77,0.08)', border: '1px solid rgba(229,72,77,0.2)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#CDD9E5', marginBottom: 3 }}>{selectedCrime.nombre}</div>
                <div style={{ fontSize: 10, color: '#8B949E', lineHeight: 1.8 }}>
                  🏍️ {selectedCrime.motos_2026} ·{' '}
                  {selectedCrime.motos_var_pct != null && (
                    <span style={{ color: selectedCrime.motos_var_pct > 0 ? '#E5484D' : '#3FB950' }}>
                      {selectedCrime.motos_var_pct > 0 ? '↑' : '↓'}{Math.abs(selectedCrime.motos_var_pct).toFixed(1)}%
                    </span>
                  )}<br/>
                  📹 {selectedCrime.camaras_total} cámaras
                </div>
                <button
                  onClick={() => setSelectedCrime(null)}
                  style={{ background: 'none', border: 'none', color: '#484F58', cursor: 'pointer', fontSize: 10, marginTop: 4, padding: 0 }}
                >
                  Cerrar ×
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Panel cuadrante seleccionado — esquina inferior izquierda ── */}
        {selectedCuad && (
          <div style={{
            position: 'absolute', bottom: 24, left: 16, zIndex: 1000,
            background: 'rgba(8,12,18,0.90)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderLeft: `3px solid ${POLICE_GREEN}`,
            borderRadius: 14, padding: '12px 16px', minWidth: 230,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: '#484F58', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Cuadrante policial
              </div>
              <button
                onClick={() => setSelectedCuad(null)}
                style={{ background: 'none', border: 'none', color: '#484F58', cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1 }}
              >×</button>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#CDD9E5', marginBottom: 4 }}>
              {selectedCuad.descripcion || selectedCuad.cuadrante_id || '—'}
            </div>
            {selectedCuad.ciudad && (
              <div style={{
                display: 'inline-block', marginBottom: 6,
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: 'rgba(127,255,0,0.10)', color: POLICE_GREEN,
                border: '1px solid rgba(127,255,0,0.30)',
              }}>
                {selectedCuad.ciudad}
              </div>
            )}
            {selectedCuad.telefono && (
              <div style={{ fontSize: 12, color: '#2F81F7', fontWeight: 600, marginTop: 6 }}>
                📞 {selectedCuad.telefono}
              </div>
            )}
          </div>
        )}

        {/* ── Style picker ─────────────────────────────────────────────── */}
        {showStylePicker && (
          <StylePicker
            current={selectedStyle}
            onSelect={s => { setSelectedStyle(s); setShowStylePicker(false) }}
            onClose={() => setShowStylePicker(false)}
          />
        )}

        {/* ── Empty state ──────────────────────────────────────────────── */}
        {devicesWithPos.length === 0 && (
          <div style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            zIndex: 800,
            padding: '12px 20px', borderRadius: 12,
            background: 'var(--card)', border: '1px solid var(--border)',
            boxShadow: 'var(--shadow)',
            fontSize: 13, color: 'var(--text2)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>📡</span>
            {fleet.length === 0
              ? 'Sin dispositivos en la flota'
              : 'Esperando señal GPS de los dispositivos'}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-componentes del header ───────────────────────────────────────────────

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

function StatusBadge({ online, total }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      padding: '4px 10px', borderRadius: 20,
      background: online > 0 ? 'var(--green-10)' : 'var(--card-alt)',
      color:      online > 0 ? 'var(--green)'    : 'var(--text3)',
      border:     online > 0 ? '1px solid rgba(63,185,80,0.3)' : '1px solid var(--border)',
    }}>
      {online} / {total} online
    </span>
  )
}

// ─── StylePicker — bottom sheet con los 4 estilos MapLibre ───────────────────

function StylePicker({ current, onSelect, onClose }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
        }}
      />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1101,
        background: '#0F1520', borderRadius: '20px 20px 0 0',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '12px 16px 32px',
      }}>
        <div style={{ width: 32, height: 3, background: '#30363D', borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: '#CDD9E5', marginBottom: 2 }}>Estilo de mapa</div>
        <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 16 }}>
          "Sistema" sigue el tema activo de la app
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {MAP_STYLES.map(s => {
            const active = s.id === current.id
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s)}
                style={{
                  padding: '10px 6px', borderRadius: 12,
                  border:     `${active ? 2 : 1}px solid ${active ? '#FF6B35' : '#30363D'}`,
                  background: active ? 'rgba(255,107,53,0.10)' : '#080C12',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                <span style={{
                  fontSize: 9, textAlign: 'center',
                  fontWeight: active ? 700 : 500,
                  color: active ? '#FF6B35' : '#8B949E',
                }}>
                  {s.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   RESUMEN DEL MÓDULO — MapPage.jsx (web-operador)
   ═══════════════════════════════════════════════════════════════════

   EXPLICACIÓN PARA HUMANO:
   Mapa operacional migrado de react-leaflet + Mapbox a MapLibre GL JS.
   Usa los mismos estilos que argus-web-usuario: paleta Waze día/noche
   aplicada sobre el style "bright" de openfreemap.

   El mapa sigue automáticamente el tema de la app (dark/light). El picker
   permite fijar Argus Día, Argus Noche o Satélite independientemente del tema.

   Al cargar la flota se hace GET /api/gps/:id/latest para cada dispositivo
   en paralelo, resolviendo el problema de marcadores sin posición inicial.

   Los eventos de cuadrante/crimen se registran con refs estables y .off().on()
   para evitar duplicados cuando MapLibre recarga el estilo al cambiar el tema.

   DIAGRAMA MENTAL:
   ┌── Header ────────────────────────────────────────────────────────┐
   │  Mapa operacional · 3 GPS · 2 online             [●●●] 2/5       │
   ├── Canvas MapLibre ──────────────────────────────────────────────┤
   │                                              [⚙️] style picker   │
   │  ██ cuadrantes (verde policía ~0.13)         [≡] toggle cuad.   │
   │       🏍️ pulse azul (online)                 [⊕] fit bounds     │
   │       🏍️ pulse rojo (armado)                 [⚠️] capa riesgo   │
   │                                                                  │
   │  [panel cuadrante]              [panel riesgo top-5 localidades] │
   └──────────────────────────────────────────────────────────────────┘

   DEUDA TÉCNICA:
   - Sin attribution control (openfreemap/ESRI requieren atribución según ToS).
   - Si la flota supera ~50 dispositivos, cambiar marcadores a GeoJSON source
     para mejor rendimiento (actualmente: 1 Marker DOM por dispositivo).
   - El endpoint /api/gps/:id/latest puede ser lento con flotas grandes;
     considerar un endpoint batch: GET /api/gps/latest?ids=a,b,c.

   ═══════════════════════════════════════════════════════════════════ */
