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
      background: '#000000',
      padding: '24px 16px',
    }}>
      <div className="argus-fadein" style={{ width: '100%', maxWidth: 420, position: 'relative' }}>

        {/* Logo + badge OPS */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src={logoDark} alt="Argus Secure" style={{ width: 210 }} />
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
            padding: '4px 14px', borderRadius: 999,
            background: 'rgba(59,139,245,0.1)', border: '1px solid rgba(110,168,255,0.2)',
          }}>
            <span aria-hidden="true" style={{
              width: 6, height: 6, borderRadius: '50%', background: '#6EA8FF',
              boxShadow: '0 0 8px #6EA8FF',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: '#7AA8E0' }}>
              CENTRAL DE MONITOREO
            </span>
          </div>
        </div>

        {/* Card */}
        <div style={{
          borderRadius: 18,
          background: '#0F0F0F',
          border: '1px solid #1E1E1E',
          padding: '32px 28px',
        }}>
          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: '#3D5066',
            marginBottom: 22, textAlign: 'center',
          }}>
            ACCESO RESTRINGIDO · ADMIN / SUPER_ADMIN
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Correo" type="email" value={email}
              onChange={setEmail} placeholder="operador@argus.com" autoComplete="email" />
            <Field label="Contraseña" type="password" value={password}
              onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />

            {error && (
              <p role="alert" style={{
                fontSize: 13, color: '#F85149', background: 'rgba(248,81,73,0.08)',
                border: '1px solid rgba(248,81,73,0.2)', borderRadius: 10,
                padding: '8px 12px', margin: 0,
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
                opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s, box-shadow 0.15s',
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
              onMouseUp={e   => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              {loading ? 'Verificando…' : 'Acceder'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.28)', marginTop: 20, letterSpacing: '0.3px' }}>
          Acceso exclusivo para personal autorizado de Argus
        </p>
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder, autoComplete }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>{label}</label>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: '#151515', border: '1px solid #2A2A2A',
          color: '#EEF2F8', borderRadius: 10,
          padding: '11px 14px', fontSize: 14, outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onFocus={e => { e.target.style.borderColor = '#3B8BF5'; e.target.style.boxShadow = '0 0 0 3px rgba(59,139,245,0.15)' }}
        onBlur={e  => { e.target.style.borderColor = '#2A2A2A'; e.target.style.boxShadow = 'none' }}
      />
    </div>
  )
}
