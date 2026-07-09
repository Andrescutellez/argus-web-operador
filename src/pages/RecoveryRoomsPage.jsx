/**
 * @fileoverview Panel de Salas de Recuperación — Central de Monitoreo (Argus Secure).
 *
 * PROPÓSITO:
 *   Permite al agente REACTION ver todas las salas de recuperación activas,
 *   unirse para coordinar por voz (LiveKit PTT) y seguir el GPS de la moto en tiempo real.
 *
 * FLUJO:
 *   1. GET /api/secure/rooms → lista de salas ACTIVE.
 *   2. Agente selecciona sala → POST /api/secure/rooms/:name/join.
 *   3. Panel de sala: mapa MapLibre con geo-stream WebSocket + botón PTT.
 *   4. Cerrar sala: DELETE /api/secure/rooms/:name con resolución.
 *
 * GEO-STREAM (WebSocket):
 *   Protocolo: primer mensaje { type:'auth', token: geoToken }
 *   Recibe: { type:'gps_update'|'last_position', lat, lng, timestamp }
 *   Reconexión: automática en _connectGeoStream con timeout 3s.
 *
 * CSS VARS (de argus-web-operador/src/index.css):
 *   --bg, --card, --card-alt, --border, --text1, --text2, --text3,
 *   --accent, --accent-10, --accent-20, --armed, --armed-10, --green, --green-10,
 *   --orange, --orange-10.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getSecureRooms, joinSecureRoomApi, closeSecureRoomApi } from '../api/apiService.js'

const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.argussecure.online'

// ─── Mapa de resolución a label/color ────────────────────────────────────────
const RESOLUTION_META = {
  RECOVERED:   { label: 'MOTO RECUPERADA',  color: 'var(--green)' },
  NOT_FOUND:   { label: 'No encontrada',    color: 'var(--orange)' },
  FALSE_ALARM: { label: 'Falsa alarma',     color: 'var(--text2)' },
}

// ─── Icono de escudo (sidebar) ────────────────────────────────────────────────
const IcShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
  </svg>
)

// ─── Componente principal ─────────────────────────────────────────────────────
export default function RecoveryRoomsPage() {
  const [rooms, setRooms]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null) // sala activa en el panel
  const [joining, setJoining]   = useState(false)
  const [closing, setClosing]   = useState(false)
  const [pttActive, setPttActive] = useState(false)

  // Geo-stream
  const wsRef        = useRef(null)
  const [geoStatus, setGeoStatus]   = useState('disconnected')
  const [lastPos, setLastPos]       = useState(null) // { lat, lng, timestamp }

  // Mapa
  const mapContainerRef = useRef(null)
  const mapRef          = useRef(null)
  const markerRef       = useRef(null)

  // ── Carga de salas ──────────────────────────────────────────────────────────
  const loadRooms = useCallback(async () => {
    try {
      const res = await getSecureRooms()
      setRooms(res.data?.rooms ?? res.data ?? [])
    } catch {
      setRooms([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRooms()
    const interval = setInterval(loadRooms, 15_000) // refresco automático cada 15s
    return () => clearInterval(interval)
  }, [loadRooms])

  // ── Unirse a sala ───────────────────────────────────────────────────────────
  const handleJoin = async (room) => {
    setJoining(true)
    try {
      const res = await joinSecureRoomApi(room.livekitRoomName)
      const data = res.data
      setSelected({ ...room, ...data })
    } catch (err) {
      alert('Error al unirse a la sala: ' + (err.response?.data?.error ?? err.message))
    } finally {
      setJoining(false)
    }
  }

  // ── Geo-stream WebSocket ────────────────────────────────────────────────────
  const connectGeoStream = useCallback((geoWsUrl, geoToken) => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    setGeoStatus('connecting')

    const wsUrl = geoWsUrl.replace(/^http/, 'ws').replace(/^https/, 'wss')
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token: geoToken }))
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'auth_ok') setGeoStatus('connected')
        if (msg.type === 'gps_update' || msg.type === 'last_position') {
          const pos = { lat: msg.lat, lng: msg.lng, timestamp: msg.timestamp }
          setLastPos(pos)
          updateMarker(pos)
        }
      } catch { /* ignore malformed frames */ }
    }
    ws.onerror  = () => setGeoStatus('error')
    ws.onclose  = () => {
      setGeoStatus('disconnected')
      // Reconexión automática si no fue un cierre intencional
      if (wsRef.current === ws) {
        setTimeout(() => {
          if (wsRef.current === ws && selected) connectGeoStream(geoWsUrl, geoToken)
        }, 3000)
      }
    }
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Inicializar geo-stream cuando hay sala seleccionada
  useEffect(() => {
    if (!selected?.geoWsUrl || !selected?.geoToken) return
    connectGeoStream(selected.geoWsUrl, selected.geoToken)
    return () => {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    }
  }, [selected?.livekitRoomName]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mapa MapLibre ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selected || !mapContainerRef.current) return
    if (mapRef.current) return // ya montado

    const initialPos = selected.lastKnownPosition
    const center = initialPos
      ? [initialPos.lng, initialPos.lat]
      : [-74.0341, 4.6956] // Bogotá

    mapRef.current = new maplibregl.Map({
      container:   mapContainerRef.current,
      style:       `${BASE_URL}/api/map/style?palette=night`,
      center,
      zoom:        15,
      attributionControl: false,
    })

    // Marcador inicial si hay posición
    if (initialPos) {
      markerRef.current = new maplibregl.Marker({ color: '#FF3B30' })
        .setLngLat([initialPos.lng, initialPos.lat])
        .addTo(mapRef.current)
    }

    return () => {
      mapRef.current?.remove()
      mapRef.current  = null
      markerRef.current = null
    }
  }, [selected?.livekitRoomName]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateMarker = ({ lat, lng }) => {
    if (!mapRef.current) return
    const lngLat = [lng, lat]
    if (markerRef.current) {
      markerRef.current.setLngLat(lngLat)
    } else {
      markerRef.current = new maplibregl.Marker({ color: '#FF3B30' })
        .setLngLat(lngLat)
        .addTo(mapRef.current)
    }
    mapRef.current.easeTo({ center: lngLat, duration: 500 })
  }

  // ── Cerrar sala ─────────────────────────────────────────────────────────────
  const handleClose = async (resolution) => {
    if (!selected || closing) return
    setClosing(true)
    try {
      await closeSecureRoomApi(selected.livekitRoomName, resolution)
      setSelected(null)
      loadRooms()
    } catch (err) {
      alert('Error al cerrar la sala: ' + (err.response?.data?.error ?? err.message))
    } finally {
      setClosing(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--armed-10)', border: '1px solid rgba(229,72,77,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--armed)',
        }}><IcShield /></div>
        <div>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>
            Salas de Recuperación
          </h1>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)' }}>
            Argus Secure — coordinación en tiempo real
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 20,
            background: rooms.length > 0 ? 'var(--armed-10)' : 'var(--card-alt)',
            color: rooms.length > 0 ? 'var(--armed)' : 'var(--text3)',
            border: `1px solid ${rooms.length > 0 ? 'rgba(229,72,77,0.3)' : 'var(--border)'}`,
            fontWeight: 700,
          }}>
            {rooms.length} {rooms.length === 1 ? 'sala activa' : 'salas activas'}
          </span>
          <button
            onClick={loadRooms}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12,
              border: '1px solid var(--border)', background: 'var(--card-alt)',
              color: 'var(--text2)', cursor: 'pointer',
            }}
          >Actualizar</button>
        </div>
      </div>

      {/* ── Body: lista | panel sala ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Lista de salas */}
        <div style={{
          width: 300, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
        }}>
          {loading ? (
            <div style={{ padding: 24, color: 'var(--text3)', fontSize: 13 }}>Cargando salas...</div>
          ) : rooms.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🛡️</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>Sin salas activas</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                Las salas aparecen aquí cuando un usuario confirma un robo.
              </div>
            </div>
          ) : rooms.map(room => (
            <RoomCard
              key={room.livekitRoomName}
              room={room}
              isSelected={selected?.livekitRoomName === room.livekitRoomName}
              joining={joining}
              onJoin={() => handleJoin(room)}
            />
          ))}
        </div>

        {/* Panel sala seleccionada */}
        {selected ? (
          <RoomPanel
            room={selected}
            geoStatus={geoStatus}
            lastPos={lastPos}
            pttActive={pttActive}
            setPttActive={setPttActive}
            closing={closing}
            onClose={handleClose}
            mapContainerRef={mapContainerRef}
          />
        ) : (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontSize: 40 }}>📡</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 600 }}>
              Selecciona una sala para monitorear
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Coordina en tiempo real con el propietario y los aliados
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tarjeta de sala en la lista ──────────────────────────────────────────────
function RoomCard({ room, isSelected, joining, onJoin }) {
  const opened = new Date(room.createdAt)
  const diff   = Math.floor((Date.now() - opened) / 60000)
  const timeLabel = diff < 60 ? `Hace ${diff} min` : `Hace ${Math.floor(diff / 60)}h`

  return (
    <div style={{
      padding: '14px 16px',
      borderBottom: '1px solid var(--border)',
      background: isSelected ? 'var(--armed-10)' : 'transparent',
      borderLeft: isSelected ? '3px solid var(--armed)' : '3px solid transparent',
      cursor: 'pointer',
      transition: 'all 0.1s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>🚨</span>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: 'var(--armed)', fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{room.livekitRoomName?.slice(0, 20)}…</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
            {timeLabel} · {room.participants?.length ?? 0} participantes
          </div>
        </div>
        {!isSelected && (
          <button
            onClick={(e) => { e.stopPropagation(); onJoin() }}
            disabled={joining}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              border: '1px solid var(--accent-20)', background: 'var(--accent-10)',
              color: 'var(--accent)', cursor: joining ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >{joining ? '…' : 'Unirse'}</button>
        )}
      </div>
      {room.lastKnownPosition && (
        <div style={{
          marginTop: 6, fontSize: 10, color: 'var(--text3)',
          fontFamily: 'monospace',
        }}>
          📍 {room.lastKnownPosition.lat?.toFixed(5)}, {room.lastKnownPosition.lng?.toFixed(5)}
        </div>
      )}
    </div>
  )
}

// ─── Panel de la sala seleccionada ────────────────────────────────────────────
function RoomPanel({ room, geoStatus, lastPos, pttActive, setPttActive, closing, onClose, mapContainerRef }) {
  const [confirmClose, setConfirmClose] = useState(null)

  const statusColor = {
    connected:    'var(--green)',
    connecting:   'var(--orange)',
    disconnected: 'var(--text3)',
    error:        'var(--armed)',
  }[geoStatus] ?? 'var(--text3)'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Sub-header sala */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: statusColor,
          }} />
          <span style={{ fontSize: 11, color: statusColor, fontWeight: 700 }}>
            {geoStatus === 'connected' ? 'GPS EN VIVO' : geoStatus.toUpperCase()}
          </span>
        </div>
        {lastPos && (
          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>
            {lastPos.lat.toFixed(5)}, {lastPos.lng.toFixed(5)}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {Object.entries(RESOLUTION_META).map(([res, meta]) => (
            <button
              key={res}
              onClick={() => setConfirmClose(res)}
              disabled={closing}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                border: '1px solid var(--border)', background: 'var(--card-alt)',
                color: 'var(--text2)', cursor: 'pointer',
              }}
            >{meta.label}</button>
          ))}
        </div>
      </div>

      {/* Mapa */}
      <div ref={mapContainerRef} style={{ flex: 1 }} />

      {/* PTT */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--border)',
        background: 'var(--card)',
      }}>
        <button
          onMouseDown={() => setPttActive(true)}
          onMouseUp={() => setPttActive(false)}
          onMouseLeave={() => setPttActive(false)}
          onTouchStart={(e) => { e.preventDefault(); setPttActive(true) }}
          onTouchEnd={() => setPttActive(false)}
          style={{
            width: '100%', height: 56, borderRadius: 12,
            border: `2px solid ${pttActive ? 'var(--armed)' : 'rgba(229,72,77,0.35)'}`,
            background: pttActive ? 'var(--armed)' : 'var(--armed-10)',
            color: pttActive ? '#fff' : 'var(--armed)',
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.1s',
            letterSpacing: '0.5px',
            boxShadow: pttActive ? '0 0 20px rgba(229,72,77,0.4)' : 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d={pttActive
              ? 'M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z'
              : 'M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 15.2 14.47 17 12 17s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V21h2v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z'
            }/>
          </svg>
          {pttActive ? 'HABLANDO...' : 'MANTENER PARA HABLAR'}
        </button>
        <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--text3)', textAlign: 'center' }}>
          Voz PTT requiere LiveKit configurado en el servidor
        </p>
      </div>

      {/* Modal de confirmación de cierre */}
      {confirmClose && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }} onClick={() => setConfirmClose(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 16, padding: 24, maxWidth: 360, width: '90%',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--text1)' }}>¿Cerrar sala?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
              Resolución: <strong style={{ color: RESOLUTION_META[confirmClose].color }}>
                {RESOLUTION_META[confirmClose].label}
              </strong><br/>
              Esta acción notificará a todos los participantes y cerrará el canal de voz.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmClose(null)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13,
                  border: '1px solid var(--border)', background: 'var(--card-alt)',
                  color: 'var(--text2)', cursor: 'pointer',
                }}
              >Cancelar</button>
              <button
                onClick={() => { setConfirmClose(null); onClose(confirmClose) }}
                disabled={closing}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13,
                  border: 'none', fontWeight: 700,
                  background: confirmClose === 'RECOVERED' ? 'var(--green)' : 'var(--orange)',
                  color: '#fff', cursor: 'pointer',
                }}
              >Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
