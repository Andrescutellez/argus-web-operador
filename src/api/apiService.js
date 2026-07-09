import axios from 'axios'

// Dominio oficial de producción — nunca IPs (regla 2026-07-09). Dev: VITE_API_URL en .env.local
const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.argussecure.online'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('argus_op_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Excluir el endpoint de login: si falla con 401 es por credenciales
    // incorrectas y el formulario debe mostrar el error, no recargar la página.
    const isLoginRequest = err.config?.url?.includes('/auth/login')
    if (err.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('argus_op_token')
      localStorage.removeItem('argus_op_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export const loginApi = (email, password) =>
  api.post('/api/auth/login', { email, password })

export const getMeApi = () =>
  api.get('/api/auth/me')

export const getLatestGps = (deviceId) =>
  api.get(`/api/gps/${deviceId}/latest`)

export const getDeviceStatus = (deviceId) =>
  api.get(`/api/device/${deviceId}/status`)

export const sendCommand = (deviceId, command) =>
  api.post(`/api/device/${deviceId}/command`, { command })

export const getAllGps = () =>
  api.get('/api/gps')

export const getAlerts = (deviceId, limit = 50) =>
  api.get(`/api/alerts/${deviceId}?limit=${limit}`)

export const acknowledgeAlert = (alertId) =>
  api.patch(`/api/alerts/${alertId}/ack`)

// Flota completa (ADMIN/SUPER_ADMIN)
export const getFleet = () =>
  api.get('/api/fleet')

// Motos del usuario autenticado (para perfil)
export const getMotos = () =>
  api.get('/api/motos')

// Auditoría
export const getAuditLogs = (params = {}) =>
  api.get('/api/audit', { params })

// Inventario de dispositivos manufacturados (SUPER_ADMIN)
export const getManufactured = () =>
  api.get('/api/manufactured')

export const addManufactured = (deviceId, imei = null, notes = null) =>
  api.post('/api/manufactured', { deviceId, imei, notes })

export const removeManufactured = (deviceId) =>
  api.delete(`/api/manufactured/${deviceId}`)

// GIS — overlay territorial para web-operador
export const getGisCuadrantes = () =>
  api.get('/api/gis/cuadrantes')

export const getGisNear = (lon, lat, type = 'cai', limit = 1) =>
  api.get('/api/gis/near', { params: { lon, lat, type, limit } })

// Criminalidad
export const getCrimeBogota = () => api.get('/api/crime/bogota')

// Agentes de reacción — solo SUPER_ADMIN
export const getAgents     = ()                      => api.get('/api/auth/agents')
export const createAgentApi = (email, password)      => api.post('/api/auth/agents', { email, password })
export const deleteIncident = (id, note = '')        => api.patch(`/api/incidents/${id}/resolve`, { resolutionNote: note })
export const getActiveIncidents = ()                 => api.get('/api/incidents/active')

// ─── Argus Secure — Salas de Recuperación ────────────────────────────────────

/** Lista todas las salas ACTIVE (solo REACTION/ADMIN/SUPER_ADMIN) */
export const getSecureRooms = () =>
  api.get('/api/secure/rooms')

/** Unirse como agente REACTION a una sala existente */
export const joinSecureRoomApi = (roomName, role = 'REACTION_CENTER') =>
  api.post(`/api/secure/rooms/${roomName}/join`, { role })

/** Cerrar sala con resolución */
export const closeSecureRoomApi = (roomName, resolution = 'NOT_FOUND') =>
  api.delete(`/api/secure/rooms/${roomName}`, { data: { resolution } })

// ─── Configuración global del sistema ────────────────────────────────────────

/** Lee la configuración actual de alertas a moteros cercanos */
export const getNearbyAlertSettingApi = () =>
  api.get('/api/settings/nearby-alert')

/** Actualiza el radio de alertas (0 = solo operadores, 1–20 km) */
export const setNearbyAlertSettingApi = (radiusKm) =>
  api.put('/api/settings/nearby-alert', { radiusKm })

export default api
