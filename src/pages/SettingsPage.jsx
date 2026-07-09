/**
 * @fileoverview Página de configuración global de la Central de Monitoreo.
 *
 * PROPÓSITO:
 *   Permite a operadores ADMIN/SUPER_ADMIN ajustar parámetros del sistema
 *   que afectan a todos los usuarios de la plataforma Argus.
 *
 * SECCIONES ACTUALES:
 *   - Alertas a moteros cercanos: radio de notificación 0–20 km.
 *     0 = solo operadores, 1–20 = km de radio.
 *
 * PERMISOS:
 *   Lectura: REACTION, ADMIN, SUPER_ADMIN
 *   Escritura: ADMIN, SUPER_ADMIN (los botones se desactivan para REACTION)
 */

import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { getNearbyAlertSettingApi, setNearbyAlertSettingApi } from '../api/apiService.js'

// ── Opciones de radio predefinidas ─────────────────────────────────────────
const RADIUS_OPTIONS = [
  { value: 0,  label: 'Solo operadores',   description: 'No notifica a usuarios de la app' },
  { value: 1,  label: '1 km',  description: null },
  { value: 2,  label: '2 km',  description: null },
  { value: 3,  label: '3 km',  description: null },
  { value: 5,  label: '5 km',  description: 'Radio recomendado' },
  { value: 8,  label: '8 km',  description: null },
  { value: 10, label: '10 km', description: null },
  { value: 15, label: '15 km', description: null },
  { value: 20, label: '20 km', description: null },
]

// ── Icono configuración ────────────────────────────────────────────────────
const IcSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
  </svg>
)

export default function SettingsPage() {
  const { user } = useStore()
  const canEdit  = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  // ── Estado ──────────────────────────────────────────────────────────────
  const [radiusKm,   setRadiusKm]   = useState(null)      // valor actual cargado
  const [selected,   setSelected]   = useState(null)      // valor seleccionado (pendiente de guardar)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [feedback,   setFeedback]   = useState(null)      // { type: 'ok'|'error', msg }

  // ── Carga inicial ───────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    setLoading(true)
    getNearbyAlertSettingApi()
      .then((res) => {
        if (!alive) return
        setRadiusKm(res.data.radiusKm)
        setSelected(res.data.radiusKm)
      })
      .catch(() => {
        if (!alive) return
        setFeedback({ type: 'error', msg: 'No se pudo cargar la configuración.' })
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // ── Guardar ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!canEdit || selected === radiusKm) return
    setSaving(true)
    setFeedback(null)
    try {
      const res = await setNearbyAlertSettingApi(selected)
      setRadiusKm(res.data.radiusKm)
      setSelected(res.data.radiusKm)
      setFeedback({ type: 'ok', msg: res.data.message ?? 'Configuración guardada.' })
    } catch {
      setFeedback({ type: 'error', msg: 'Error al guardar. Intenta de nuevo.' })
    } finally {
      setSaving(false)
    }
  }

  const isDirty = selected !== null && selected !== radiusKm

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div style={{
          width: 44, height: 44,
          background: 'var(--accent-10)', border: '1px solid var(--accent-20)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent)',
        }}>
          <IcSettings />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text1)' }}>
            Configuración del sistema
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text3)' }}>
            Parámetros globales que aplican a todos los usuarios
          </p>
        </div>
      </div>

      {/* Sección — Alertas cercanas */}
      <section style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
      }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>
            Alertas a moteros cercanos
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
            Cuando un usuario reporta un robo, el sistema puede notificar a otros
            moteros Argus activos dentro del radio seleccionado. Aparece como un
            banner rojo en la app. Puedes desactivarlo inmediatamente seleccionando
            &ldquo;Solo operadores&rdquo;.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 14 }}>
            Cargando configuración…
          </div>
        ) : (
          <>
            {/* Grid de opciones */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 8,
              marginBottom: 20,
            }}>
              {RADIUS_OPTIONS.map(({ value, label, description }) => {
                const isActive = selected === value
                return (
                  <button
                    key={value}
                    disabled={!canEdit}
                    onClick={() => canEdit && setSelected(value)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: isActive
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border)',
                      background: isActive ? 'var(--accent-10)' : 'var(--card-alt)',
                      color: isActive ? 'var(--accent)' : 'var(--text2)',
                      fontWeight: isActive ? 700 : 400,
                      fontSize: 13,
                      cursor: canEdit ? 'pointer' : 'default',
                      textAlign: 'left',
                      opacity: canEdit ? 1 : 0.75,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontWeight: isActive ? 700 : 600 }}>{label}</div>
                    {description && (
                      <div style={{ fontSize: 11, marginTop: 2, opacity: 0.75 }}>{description}</div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Descripción del modo activo */}
            {selected === 0 ? (
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--armed-10)', border: '1px solid var(--armed-20)',
                color: 'var(--armed)', fontSize: 13, marginBottom: 16,
              }}>
                <strong>Modo actual: Solo operadores</strong> — Los usuarios de la app
                NO recibirán alertas de robos cercanos.
              </div>
            ) : selected != null ? (
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--accent-10)', border: '1px solid var(--accent-20)',
                color: 'var(--accent)', fontSize: 13, marginBottom: 16,
              }}>
                <strong>Modo: {selected} km de radio</strong> — Los moteros con GPS
                activo en los últimos 10 minutos dentro de {selected} km recibirán la alerta.
              </div>
            ) : null}

            {/* Feedback */}
            {feedback && (
              <div style={{
                padding: '10px 14px', borderRadius: 10, marginBottom: 12,
                background: feedback.type === 'ok' ? 'rgba(46,125,50,0.12)' : 'var(--armed-10)',
                border: `1px solid ${feedback.type === 'ok' ? 'rgba(46,125,50,0.3)' : 'var(--armed-20)'}`,
                color: feedback.type === 'ok' ? '#4caf50' : 'var(--armed)',
                fontSize: 13,
              }}>
                {feedback.msg}
              </div>
            )}

            {/* Botón guardar */}
            {canEdit && (
              <button
                disabled={!isDirty || saving}
                onClick={handleSave}
                style={{
                  padding: '10px 22px',
                  borderRadius: 10,
                  border: 'none',
                  background: isDirty ? 'var(--accent)' : 'var(--card-alt)',
                  color: isDirty ? '#fff' : 'var(--text3)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: isDirty && !saving ? 'pointer' : 'default',
                  opacity: saving ? 0.7 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {saving ? 'Guardando…' : isDirty ? 'Guardar cambios' : 'Sin cambios'}
              </button>
            )}

            {!canEdit && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
                Tu rol no tiene permisos para modificar esta configuración.
              </div>
            )}
          </>
        )}
      </section>

    </div>
  )
}
