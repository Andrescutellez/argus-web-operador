/**
 * @fileoverview Página de inventario de dispositivos manufacturados.
 *
 * PROPÓSITO:
 *   Permite al SUPER_ADMIN registrar, consultar y revocar los dispositivos
 *   ESP32 autorizados antes de ser entregados a clientes.
 *
 * FLUJO:
 *   Al montar: GET /api/manufactured → lista la tabla
 *   Formulario: POST /api/manufactured → agrega y refresca
 *   Botón eliminar: DELETE /api/manufactured/:deviceId → revoca y refresca
 *
 * @module pages/InventoryPage
 */

import { useEffect, useState } from 'react'
import { getManufactured, addManufactured, removeManufactured } from '../api/apiService.js'
import { useStore } from '../store/useStore.js'

const EMPTY_FORM = { deviceId: '', imei: '', notes: '', protocol: 'argus' }

const PROTOCOL_LABELS = { argus: 'Argus Pro (ESP32)', gt06: 'Argus One (J16)' }
const PROTOCOL_COLORS = { argus: '#FF6B35', gt06: '#2F81F7' }

const inputStyle = {
  fontSize: 13, padding: '9px 12px',
  borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text1)',
  outline: 'none', fontFamily: 'monospace',
  width: '100%', transition: 'border-color 0.15s',
}

export default function InventoryPage() {
  const user = useStore((s) => s.user)

  const [devices,  setDevices]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState(null)
  const [success,  setSuccess]  = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await getManufactured()
      setDevices(data)
    } catch {
      setError('No se pudo cargar el inventario')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.deviceId.trim()) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await addManufactured(form.deviceId.trim(), form.imei.trim() || null, form.notes.trim() || null, form.protocol)
      setSuccess(`${form.deviceId.trim()} registrado correctamente`)
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Error al registrar')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (deviceId) => {
    if (!confirm(`¿Revocar ${deviceId}? El dispositivo no podrá conectarse.`)) return
    setError(null)
    setSuccess(null)
    try {
      await removeManufactured(deviceId)
      setSuccess(`${deviceId} revocado`)
      await load()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Error al revocar')
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
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text1)' }}>Inventario</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)' }}>
          {devices.length} dispositivos autorizados en el sistema
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
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', marginBottom: 14 }}>
          REGISTRAR NUEVO DISPOSITIVO
        </div>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>Device ID *</label>
            <input
              value={form.deviceId}
              onChange={(e) => setForm((f) => ({ ...f, deviceId: e.target.value }))}
              placeholder="ARGUS-1237E630"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--blue)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>IMEI</label>
            <input
              value={form.imei}
              onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value }))}
              placeholder="869412073568211"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--blue)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>Modelo</label>
            <select
              value={form.protocol}
              onChange={(e) => setForm((f) => ({ ...f, protocol: e.target.value }))}
              style={{ ...inputStyle, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              <option value="argus">Argus Pro (ESP32)</option>
              <option value="gt06">Argus One (J16)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>Notas</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Lote mayo 2026 · MAC: 00:4B:12:37:E6:30"
              style={{ ...inputStyle, fontFamily: 'inherit' }}
              onFocus={e => e.target.style.borderColor = 'var(--blue)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <button
            type="submit"
            disabled={saving || !form.deviceId.trim()}
            style={{
              fontSize: 13, fontWeight: 600,
              padding: '9px 18px', borderRadius: 8,
              border: 'none',
              background: saving || !form.deviceId.trim() ? 'var(--border)' : 'var(--blue)',
              color: saving || !form.deviceId.trim() ? 'var(--text3)' : '#fff',
              cursor: saving || !form.deviceId.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Guardando…' : '+ Registrar'}
          </button>
        </form>
      </div>

      {/* Tabla */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
            Cargando inventario…
          </div>
        ) : devices.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>No hay dispositivos registrados</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Device ID', 'IMEI', 'Modelo', 'Notas', 'Registrado', 'Acción'].map((h) => (
                  <th key={h} style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 11, fontWeight: 600,
                    color: 'var(--text2)',
                    background: 'var(--card-alt)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr
                  key={d.device_id}
                  style={{ borderBottom: '1px solid var(--border-sub)', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--card-alt)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>
                      {d.device_id}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text2)' }}>
                      {d.imei ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px',
                      borderRadius: 6,
                      background: `${PROTOCOL_COLORS[d.device_protocol] ?? '#FF6B35'}22`,
                      color: PROTOCOL_COLORS[d.device_protocol] ?? '#FF6B35',
                    }}>
                      {PROTOCOL_LABELS[d.device_protocol] ?? d.device_protocol}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {d.notes ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {new Date(d.registered_at).toLocaleString('es-PE', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => handleRemove(d.device_id)}
                      style={{
                        fontSize: 11, fontWeight: 600,
                        padding: '4px 10px', borderRadius: 6,
                        border: '1px solid rgba(229,72,77,0.3)',
                        background: 'var(--armed-10)', color: 'var(--armed)',
                        cursor: 'pointer',
                      }}
                    >
                      Revocar
                    </button>
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
