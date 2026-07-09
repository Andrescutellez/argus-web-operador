import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { getFleet } from '../api/apiService.js'
import { connect, disconnect } from '../api/realtimeService.js'

const ALERT_META = {
  STATE_ALERT:   { label: 'Alerta',      color: 'var(--armed)', bg: 'var(--armed-10)', icon: '🔔' },
  STATE_PURSUIT: { label: 'Persecución', color: 'var(--red)',   bg: 'var(--armed-10)', icon: '🚨' },
  ARM:           { label: 'Armado',      color: 'var(--blue)',  bg: 'var(--blue-10)',  icon: '🛡️' },
  DISARM:        { label: 'Desarmado',   color: 'var(--text2)', bg: 'var(--card-alt)', icon: '🔓' },
  ENGINE_CUT:    { label: 'Corte motor', color: 'var(--red)',   bg: 'var(--armed-10)', icon: '✂️' },
}

function StatCard({ label, value, sub, icon, accentColor, accentBg, accentBorder }) {
  return (
    <div style={{
      background: accentBg || 'var(--card)',
      border: `1px solid ${accentBorder || 'var(--border)'}`,
      borderRadius: 14,
      padding: '18px 20px',
    }}>
      <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accentColor || 'var(--text1)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { fleet, alerts, setFleet, updateDevice, addAlert } = useStore()

  const online       = fleet.filter((d) => d.connected).length
  const activeAlerts = alerts.filter((a) => !a.acknowledged && ['STATE_ALERT','STATE_PURSUIT'].includes(a.type)).length
  const premium      = fleet.filter((d) => d.plan === 'PREMIUM').length

  useEffect(() => {
    getFleet().then(({ data }) => setFleet(data)).catch(() => {})
    connect(
      (data) => updateDevice(data.deviceId, { lat: data.lat, lon: data.lon, speed: data.speed, lastSeen: data.timestamp, connected: true }),
      (alert) => addAlert(alert),
    )
    return () => disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ padding: 24, background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text1)' }}>Dashboard</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)' }}>
          Resumen de la flota en tiempo real
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard
          icon="📡" label="Dispositivos totales"
          value={fleet.length} sub="en la flota"
        />
        <StatCard
          icon="🟢" label="En línea ahora"
          value={online} sub={`de ${fleet.length} total`}
          accentColor="var(--green)"
          accentBg="var(--green-10)"
          accentBorder="rgba(63,185,80,0.3)"
        />
        <StatCard
          icon="🔔" label="Alertas activas"
          value={activeAlerts} sub="sin atender"
          accentColor={activeAlerts > 0 ? 'var(--armed)' : undefined}
          accentBg={activeAlerts > 0 ? 'var(--armed-10)' : undefined}
          accentBorder={activeAlerts > 0 ? 'rgba(229,72,77,0.3)' : undefined}
        />
        <StatCard
          icon="⭐" label="Plan Premium"
          value={premium} sub={`${fleet.length - premium} freemium`}
          accentColor="var(--blue)"
          accentBg="var(--blue-10)"
          accentBorder="var(--blue-20)"
        />
      </div>

      {/* Fleet + Alertas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Flota */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>Estado de la flota</h2>
            <span style={{
              fontSize: 11, fontWeight: 600,
              padding: '3px 8px', borderRadius: 20,
              background: 'var(--green-10)', color: 'var(--green)',
              border: '1px solid rgba(63,185,80,0.3)',
            }}>{online} online</span>
          </div>

          {fleet.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>Sin dispositivos registrados</p>
            </div>
          ) : fleet.map((d) => (
            <div key={d.deviceId} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 18px',
              borderBottom: '1px solid var(--border-sub)',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: d.connected ? 'var(--green)' : 'var(--text3)',
                boxShadow: d.connected ? '0 0 6px rgba(63,185,80,0.5)' : 'none',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.alias}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.email}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: d.connected ? 'var(--green)' : 'var(--text3)', marginBottom: 2 }}>
                  {d.connected ? 'Online' : 'Offline'}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  padding: '2px 6px', borderRadius: 4,
                  background: d.plan === 'PREMIUM' ? 'var(--blue-10)' : 'var(--card-alt)',
                  color: d.plan === 'PREMIUM' ? 'var(--blue)' : 'var(--text3)',
                }}>{d.plan}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Alertas recientes */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>Alertas recientes</h2>
            {activeAlerts > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                padding: '3px 8px', borderRadius: 20,
                background: 'var(--armed)', color: '#fff',
              }}>{activeAlerts} críticas</span>
            )}
          </div>

          {alerts.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>Sin alertas recientes</p>
            </div>
          ) : alerts.slice(0, 10).map((a, i) => {
            const meta = ALERT_META[a.type] ?? { label: a.type, color: 'var(--text2)', bg: 'var(--card-alt)', icon: '•' }
            return (
              <div key={a._id || i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 18px',
                borderBottom: '1px solid var(--border-sub)',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: meta.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0,
                }}>{meta.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>
                      {new Date(a.timestamp || a.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace', marginTop: 2 }}>
                    {a.deviceId}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
