/**
 * @fileoverview Gestión de agentes de reacción — exclusivo SUPER_ADMIN.
 *
 * PROPÓSITO:
 *   Permite al SUPER_ADMIN crear y listar los agentes de reacción del sistema
 *   Argus Community. El registro es cerrado: los agentes no pueden auto-registrarse.
 *
 * FLUJO:
 *   Al montar: GET /api/auth/agents → lista agentes REACTION
 *   Formulario: POST /api/auth/agents → crea agente y refresca
 *
 * @module pages/AgentsPage
 */

import { useEffect, useState } from 'react'
import { getAgents, createAgentApi } from '../api/apiService.js'
import { useStore } from '../store/useStore.js'

const EMPTY_FORM = { email: '', password: '' }

const inputStyle = {
  fontSize: 13, padding: '9px 12px',
  borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text1)',
  outline: 'none', width: '100%', transition: 'border-color 0.15s',
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AgentsPage() {
  const user = useStore((s) => s.user)

  const [agents,  setAgents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)
  const [success, setSuccess] = useState(null)
  const [showPwd, setShowPwd] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await getAgents()
      setAgents(data)
    } catch {
      setError('No se pudo cargar la lista de agentes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.email.trim() || !form.password.trim()) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const { data } = await createAgentApi(form.email.trim(), form.password)
      setSuccess(`Agente ${data.email} creado correctamente`)
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Error al crear el agente')
    } finally {
      setSaving(false)
    }
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ fontSize: 14, color: 'var(--text3)' }}>Acceso denegado — solo SUPER_ADMIN</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text1)' }}>Agentes de Reacción</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)' }}>
          {loading ? 'Cargando…' : `${agents.length} agente${agents.length !== 1 ? 's' : ''} registrado${agents.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Feedback */}
      {error && (
        <div style={{
          fontSize: 13, padding: '12px 16px', borderRadius: 10,
          background: 'var(--armed-10)', color: 'var(--armed)',
          border: '1px solid rgba(229,72,77,0.3)',
        }}>
          ✗ {error}
        </div>
      )}
      {success && (
        <div style={{
          fontSize: 13, padding: '12px 16px', borderRadius: 10,
          background: 'var(--green-10)', color: 'var(--green)',
          border: '1px solid rgba(63,185,80,0.3)',
        }}>
          ✓ {success}
        </div>
      )}

      {/* Formulario */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', marginBottom: 14 }}>
          CREAR NUEVO AGENTE
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
          Los agentes de reacción reciben alertas de robo en tiempo real y pueden
          seguir incidentes activos desde la app Argus con role <strong>REACTION</strong>.
          Comparte la contraseña temporal de forma segura — el agente debería cambiarla al primer acceso.
        </p>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220, flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>Correo electrónico *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="agente@argus.com"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--blue)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>Contraseña temporal *</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                style={{ ...inputStyle, paddingRight: 40 }}
                onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text3)', fontSize: 11, padding: 0,
                }}
              >
                {showPwd ? 'ocultar' : 'ver'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !form.email.trim() || form.password.length < 8}
            style={{
              fontSize: 13, fontWeight: 600,
              padding: '9px 18px', borderRadius: 8,
              border: 'none',
              background: (saving || !form.email.trim() || form.password.length < 8)
                ? 'var(--border)' : 'var(--blue)',
              color: (saving || !form.email.trim() || form.password.length < 8)
                ? 'var(--text3)' : '#fff',
              cursor: (saving || !form.email.trim() || form.password.length < 8)
                ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {saving ? 'Creando…' : '+ Crear agente'}
          </button>
        </form>
      </div>

      {/* Tabla */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
            Cargando agentes…
          </div>
        ) : agents.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🛡️</div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>No hay agentes registrados aún</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Agente', 'Role', 'Creado'].map((h) => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: 11, fontWeight: 600,
                    color: 'var(--text2)', background: 'var(--card-alt)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr
                  key={a.id}
                  style={{ borderBottom: '1px solid var(--border-sub)', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--card-alt)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
                      }}>
                        {a.email[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text1)' }}>{a.email}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      fontSize: 10, fontWeight: 700,
                      padding: '3px 8px', borderRadius: 5,
                      background: 'rgba(255,107,53,0.12)',
                      border: '1px solid rgba(255,107,53,0.25)',
                      color: 'var(--accent)', letterSpacing: '0.06em',
                    }}>
                      {a.role}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'monospace' }}>
                      {fmt(a.created_at)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}
