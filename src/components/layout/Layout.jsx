/**
 * @fileoverview Layout de la Central de Monitoreo (operador).
 * Desktop-first con sidebar. SVG icons, aria-labels, focus-visible, accent color.
 */

import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useEffect } from 'react'
import iconLight from '../../assets/icon_light.png'
import iconDark from '../../assets/icon_dark.png'

// ─── SVG Icons ───────────────────────────────────────────────────────────────
const IcDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13 2.05v2.02c3.95.49 7 3.85 7 7.93 0 3.21-1.81 6-4.72 7.72L13 17v5h5l-1.22-1.22C19.91 19.07 22 15.76 22 12c0-5.18-3.95-9.45-9-9.95zM11 2.05C5.95 2.55 2 6.82 2 12c0 3.76 2.09 7.07 5.22 8.78L6 22h5V2.05zM11 13H9V7h2v6zm4 0h-2V7h2v6z"/>
  </svg>
)
const IcMap = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>
  </svg>
)
const IcDevices = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
  </svg>
)
const IcBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
  </svg>
)
const IcInventory = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20 6h-2.18c.07-.44.18-.87.18-1.33C18 2.54 15.88.5 13.25.5c-1.48 0-2.74.61-3.59 1.63L9 2.87l-.66-.74C7.49 1.11 6.23.5 4.75.5 2.12.5 0 2.54 0 4.67c0 .46.11.89.18 1.33H0v2h20V6zm-9.5 0H5c0-.36-.06-.71-.06-1.08C4.94 3.63 5.8 2.5 6.75 2.5c.65 0 1.25.32 1.63.84L9 4.13l.62-.79C10 2.82 10.6 2.5 11.25 2.5c.95 0 1.81 1.13 1.81 2.42 0 .37-.06.72-.06 1.08H10.5zM2 20c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V10H2v10zm6-7h8v2H8v-2z"/>
  </svg>
)
const IcAgents = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
  </svg>
)
const IcShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
  </svg>
)
const IcMoon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
  </svg>
)
const IcSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-12.37l-1.06 1.06a.996.996 0 000 1.41c.39.39 1.03.39 1.41 0l1.06-1.06a.996.996 0 000-1.41-.996.996 0 00-1.41 0zM7.05 18.36l-1.06 1.06a.996.996 0 000 1.41c.39.39 1.03.39 1.41 0l1.06-1.06a.996.996 0 000-1.41-.96.96 0 00-1.41 0z"/>
  </svg>
)
const IcLogout = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
  </svg>
)
const IcSettingsNav = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
  </svg>
)

const NAV = [
  { to: '/dashboard',      Icon: IcDashboard, label: 'Dashboard',      role: null },
  { to: '/map',            Icon: IcMap,       label: 'Mapa flota',     role: null },
  { to: '/devices',        Icon: IcDevices,   label: 'Dispositivos',   role: null },
  { to: '/alerts',         Icon: IcBell,      label: 'Alertas',        role: null },
  { to: '/recovery-rooms', Icon: IcShield,    label: 'Salas activas',  role: null },
  { to: '/inventory',      Icon: IcInventory,   label: 'Inventario',    role: 'SUPER_ADMIN' },
  { to: '/agents',         Icon: IcAgents,      label: 'Agentes',       role: 'SUPER_ADMIN' },
  { to: '/settings',       Icon: IcSettingsNav, label: 'Configuración', roles: ['ADMIN', 'SUPER_ADMIN'] },
]

export default function Layout() {
  const { user, logout, alerts, theme, setTheme } = useStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  if (!user) return <Navigate to="/login" replace />

  const criticalAlerts = alerts.filter((a) =>
    ['STATE_ALERT', 'STATE_PURSUIT', 'ENGINE_CUT'].includes(a.type) && !a.acknowledged
  ).length

  const isDark  = theme === 'dark'
  const navIcon = isDark ? iconDark : iconLight

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <aside role="complementary" aria-label="Menú de navegación" style={{
        width: 230, flexShrink: 0,
        background: 'var(--card)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Logo OPS */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <img src={navIcon} alt="Argus" style={{ width: 38, height: 38, objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>Argus</span>
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 4,
                  background: 'var(--accent-10)',
                  border: '1px solid var(--accent-20)',
                  color: 'var(--accent)',
                  letterSpacing: '1px',
                }}>OPS</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Central de Monitoreo</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav role="navigation" aria-label="Navegación principal" style={{ flex: 1, padding: '10px 8px' }}>
          {NAV.filter(({ role, roles }) => !role && !roles || (roles ? roles.includes(user?.role) : user?.role === role)).map(({ to, Icon, label }) => (
            <NavLink key={to} to={to} aria-label={label} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, marginBottom: 2,
              fontSize: 14, fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent)' : 'var(--text2)',
              background: isActive ? 'var(--accent-10)' : 'transparent',
              textDecoration: 'none',
              border: isActive ? '1px solid var(--accent-20)' : '1px solid transparent',
              transition: 'all 0.15s', position: 'relative',
            })}
              onMouseEnter={e => {
                if (!e.currentTarget.classList.contains('active')) {
                  e.currentTarget.style.background = 'var(--card-alt)'
                  e.currentTarget.style.color = 'var(--text1)'
                }
              }}
              onMouseLeave={e => {
                if (!e.currentTarget.classList.contains('active')) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text2)'
                }
              }}
            >
              <Icon />
              <span style={{ flex: 1 }}>{label}</span>
              {label === 'Alertas' && criticalAlerts > 0 && (
                <span className="argus-badge" aria-label={`${criticalAlerts} alertas críticas`}>
                  {criticalAlerts}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 12px 16px', borderTop: '1px solid var(--border)' }}>
          {/* Toggle tema */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', borderRadius: 10,
              background: 'var(--card-alt)', border: '1px solid var(--border)',
              marginBottom: 10, fontSize: 12, color: 'var(--text2)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isDark ? <IcMoon /> : <IcSun />}
              {isDark ? 'Oscuro' : 'Claro'}
            </span>
            <div style={{
              width: 36, height: 20,
              background: isDark ? 'var(--accent)' : 'var(--border)',
              borderRadius: 10, position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                width: 14, height: 14, background: '#fff', borderRadius: '50%',
                position: 'absolute', top: 3,
                left: isDark ? 19 : 3, transition: 'left 0.2s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }} />
            </div>
          </button>

          {/* Info usuario */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--accent-10)', border: '1px solid var(--accent-20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
            }}>{(user.name ?? user.email)?.[0]?.toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 11, color: 'var(--text1)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{user.email}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{user.role}</div>
            </div>
          </div>

          <button
            onClick={logout}
            aria-label="Cerrar sesión"
            style={{
              width: '100%', padding: '8px 0',
              borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text2)',
              fontSize: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 6, transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--armed-10)'
              e.currentTarget.style.color = 'var(--armed)'
              e.currentTarget.style.borderColor = 'var(--armed-20)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text2)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <IcLogout /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main role="main" style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  )
}
