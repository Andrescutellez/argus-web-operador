import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { loginApi } from '../api/apiService.js'
import logoDark from '../assets/logo_dark_transparent.png'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const login    = useStore((s) => s.login)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { setError('Completa todos los campos'); return }

    setLoading(true)
    setError('')
    try {
      const { data } = await loginApi(email, password)

      if (data.user.role !== 'ADMIN' && data.user.role !== 'SUPER_ADMIN') {
        setError('Esta plataforma es solo para operadores')
        return
      }

      login(data)
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Error de conexión'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(160deg, #07142A 0%, #0F3060 50%, #15448C 100%)',
      padding: '24px 16px',
    }}>
      {/* Blobs degradados difuminados — mismo lenguaje que la app de usuario */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: '-14%', right: '-12%', width: 520, height: 520,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,139,245,0.4), transparent 72%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', bottom: '-20%', left: '-14%', width: 480, height: 480,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(110,168,255,0.3), transparent 72%)',
        filter: 'blur(55px)', pointerEvents: 'none',
      }} />

      {/* Esquinas tipo HUD — identidad "central de monitoreo" */}
      {[
        { top: 18, left: 18, borderWidth: '2px 0 0 2px' },
        { top: 18, right: 18, borderWidth: '2px 2px 0 0' },
        { bottom: 18, left: 18, borderWidth: '0 0 2px 2px' },
        { bottom: 18, right: 18, borderWidth: '0 2px 2px 0' },
      ].map((pos, i) => (
        <div key={i} aria-hidden="true" style={{
          position: 'absolute', width: 28, height: 28,
          borderColor: 'rgba(110,168,255,0.35)', borderStyle: 'solid',
          ...pos,
        }} />
      ))}

      <div className="argus-fadein" style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Logo + badge OPS */}
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <span aria-hidden="true" style={{
              position: 'absolute', inset: -12,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(110,168,255,0.35), transparent 72%)',
              animation: 'argus-pulse 2.4s ease-in-out infinite',
            }} />
            <img src={logoDark} alt="Argus Secure" style={{ width: 200, position: 'relative', filter: 'drop-shadow(0 8px 28px rgba(0,0,0,0.45))' }} />
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
            padding: '4px 12px', borderRadius: 999,
            background: 'rgba(59,139,245,0.15)', border: '1px solid rgba(110,168,255,0.3)',
          }}>
            <span aria-hidden="true" style={{
              width: 6, height: 6, borderRadius: '50%', background: '#6EA8FF',
              boxShadow: '0 0 8px #6EA8FF',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: '#9CC4FF' }}>
              CENTRAL DE MONITOREO
            </span>
          </div>
        </div>

        {/* Card con borde degradado */}
        <div style={{
          borderRadius: 20,
          padding: 1.5,
          background: 'linear-gradient(160deg, rgba(110,168,255,0.35), rgba(110,168,255,0.05) 45%, transparent 75%)',
          boxShadow: '0 24px 60px rgba(2,8,20,0.55)',
        }}>
          <div style={{ background: '#0C1726', borderRadius: 18.5, padding: '32px 30px' }}>
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: '#5C7A9C',
              marginBottom: 22, textAlign: 'center',
            }}>
              ACCESO RESTRINGIDO · ADMIN / SUPER_ADMIN
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Field
                label="Correo"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="operador@argus.com"
                autoComplete="email"
              />
              <Field
                label="Contraseña"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                autoComplete="current-password"
              />

              {error && (
                <p role="alert" style={{
                  fontSize: 13, color: '#F85149', background: 'rgba(248,81,73,0.1)',
                  border: '1px solid rgba(248,81,73,0.25)', borderRadius: 10, padding: '8px 12px',
                }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4, padding: '13px 0', borderRadius: 12, border: 'none',
                  fontSize: 14.5, fontWeight: 700, letterSpacing: '0.3px', color: '#fff',
                  background: 'linear-gradient(135deg, #1A6FD4, #0F3060)',
                  boxShadow: loading ? 'none' : '0 8px 22px rgba(26,111,212,0.4)',
                  opacity: loading ? 0.6 : 1,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
                onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                {loading ? 'Verificando…' : 'Acceder'}
              </button>
            </form>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 20, letterSpacing: '0.3px' }}>
          Acceso exclusivo para personal autorizado de Argus
        </p>
      </div>

      <style>{`
        @keyframes argus-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.08); }
        }
      `}</style>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder, autoComplete }) {
  return (
    <div className="flex flex-col gap-1">
      <label style={{ fontSize: 12.5, fontWeight: 600, color: '#7E95B0' }}>{label}</label>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: '#121B28',
          border: '1px solid #1C2B40',
          color: '#EEF2F8',
          borderRadius: 10,
          padding: '11px 14px',
          fontSize: 14,
          outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onFocus={e => { e.target.style.borderColor = '#3B8BF5'; e.target.style.boxShadow = '0 0 0 3px rgba(59,139,245,0.15)' }}
        onBlur={e  => { e.target.style.borderColor = '#1C2B40'; e.target.style.boxShadow = 'none' }}
      />
    </div>
  )
}
