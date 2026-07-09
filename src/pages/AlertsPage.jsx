import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { connect, getSocket } from '../api/realtimeService.js'
import { getAlerts, acknowledgeAlert } from '../api/apiService.js'

const ALERT_META = {
  STATE_ALERT:   { label: 'ALERTA',       color: 'var(--armed)',  bg: 'var(--armed-10)',  icon: '🔔' },
  STATE_PURSUIT: { label: 'Persecución',  color: 'var(--red)',    bg: 'var(--armed-10)',  icon: '🚨' },
  ENGINE_CUT:    { label: 'Corte motor',  color: 'var(--red)',    bg: 'var(--armed-10)',  icon: '✂️' },
  ARM:           { label: 'Armado',       color: 'var(--blue)',   bg: 'var(--blue-10)',   icon: '🛡️' },
  DISARM:        { label: 'Desarmado',    color: 'var(--text2)',  bg: 'var(--card-alt)',  icon: '🔓' },
  ALERT_CMD:     { label: 'Alerta remota',color: 'var(--armed)',  bg: 'var(--armed-10)',  icon: '📡' },
  STATE_MOVING:  { label: 'En movimiento',color: 'var(--orange)', bg: 'var(--orange-10)', icon: '⚡' },
  STATE_IDLE:    { label: 'Detenido',     color: 'var(--text2)',  bg: 'var(--card-alt)',  icon: '⏹' },
}

const CRITICAL = new Set(['STATE_ALERT', 'STATE_PURSUIT', 'ENGINE_CUT'])

function AlertRow({ alert, onAck }) {
  const meta     = ALERT_META[alert.type] ?? { label: alert.type, color: 'var(--text2)', bg: 'var(--card-alt)', icon: '•' }
  const critical = CRITICAL.has(alert.type)
  const time     = new Date(alert.timestamp)

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '14px 18px',
      borderBottom: '1px solid var(--border-sub)',
      opacity: alert.acknowledged ? 0.45 : 1,
      background: critical && !alert.acknowledged ? 'rgba(229,72,77,0.04)' : 'transparent',
      transition: 'background 0.15s',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: meta.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, flexShrink: 0,
      }}>{meta.icon}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{meta.label}</span>
          <span style={{
            fontSize: 10, fontFamily: 'monospace',
            padding: '2px 6px', borderRadius: 4,
            background: 'var(--card-alt)', color: 'var(--text3)',
          }}>{alert.deviceId}</span>
          {alert.source === 'command' && (
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 4,
              background: 'var(--blue-10)', color: 'var(--blue)',
            }}>cmd</span>
          )}
        </div>
        {alert.message && (
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text2)' }}>{alert.message}</p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <time style={{ fontSize: 11, color: 'var(--text3)' }}>
          {time.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </time>
        {critical && !alert.acknowledged && (
          <button
            onClick={() => onAck(alert._id)}
            style={{
              fontSize: 11, fontWeight: 600,
              padding: '5px 10px', borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--card-alt)', color: 'var(--text2)',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--green-10)'; e.currentTarget.style.color = 'var(--green)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--card-alt)'; e.currentTarget.style.color = 'var(--text2)' }}
          >Atender</button>
        )}
      </div>
    </div>
  )
}

export default function AlertsPage() {
  const { alerts, setAlerts, addAlert, acknowledgeAlertLocal, fleet } = useStore()

  useEffect(() => {
    const ids = fleet.map((d) => d.deviceId)
    Promise.allSettled(ids.map((id) => getAlerts(id, 20)))
      .then((results) => {
        const all = results
          .filter((r) => r.status === 'fulfilled')
          .flatMap((r) => r.value.data)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        setAlerts(all.slice(0, 200))
      })
    const handleAlert = (data) => addAlert(data)
    connect(null, null, handleAlert)
    return () => { getSocket()?.off('alert:new', handleAlert) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAck = async (alertId) => {
    try { await acknowledgeAlert(alertId); acknowledgeAlertLocal(alertId) } catch (_) {}
  }

  const critical = alerts.filter((a) => CRITICAL.has(a.type) && !a.acknowledged)

  return (
    <div style={{ padding: 24, background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text1)' }}>Feed de alertas</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)' }}>
            {alerts.length} eventos · {critical.length} críticos sin atender
          </p>
        </div>
        {critical.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 10,
            background: 'var(--armed-10)',
            border: '1px solid rgba(229,72,77,0.4)',
            fontSize: 13, fontWeight: 600, color: 'var(--armed)',
            flexShrink: 0,
          }}>
            ⚠️ {critical.length} activa{critical.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Panel de críticas */}
      {critical.length > 0 && (
        <div style={{
          padding: 16, borderRadius: 14, marginBottom: 20,
          background: 'rgba(229,72,77,0.06)',
          border: '1px solid rgba(229,72,77,0.35)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--armed)', marginBottom: 10 }}>
            🔴 Alertas críticas sin atender
          </div>
          {critical.slice(0, 3).map((a) => (
            <div key={a._id ?? a.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 12, marginBottom: 6, color: 'var(--text2)',
            }}>
              <span style={{ color: 'var(--armed)' }}>⚠</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--text3)' }}>{a.deviceId}</span>
              <span style={{ color: 'var(--text1)' }}>{a.message ?? ALERT_META[a.type]?.label ?? a.type}</span>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Feed en tiempo real</span>
        </div>

        {alerts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text3)' }}>Sin eventos registrados</p>
          </div>
        ) : alerts.map((a) => (
          <AlertRow key={a._id ?? a.id} alert={a} onAck={handleAck} />
        ))}
      </div>
    </div>
  )
}
