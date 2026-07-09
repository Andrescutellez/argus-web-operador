/**
 * @fileoverview Store global del Web Operador (Zustand).
 *
 * PROPÓSITO:
 *   Centraliza el estado de la flota, alertas y autenticación del operador.
 *   La flota se carga desde el endpoint real /api/fleet y se enriquece en
 *   tiempo real via socket.io (posición GPS de cada dispositivo).
 *
 * VARIABLES CRÍTICAS:
 *   fleet  — Array de { deviceId, email, plan, alias, placa, connected,
 *             lat, lon, speed, lastSeen, armed }
 *             Se construye a partir de la respuesta de /api/fleet y se
 *             actualiza con eventos gps:update de socket.io.
 *   alerts — Cola de alertas en tiempo real, max 200 elementos.
 *
 * @module store/useStore
 */

import { create } from 'zustand'

const storedOpTheme = localStorage.getItem('argus_op_theme') || 'dark'
document.documentElement.setAttribute('data-theme', storedOpTheme)

export const useStore = create((set) => ({
  // ── Tema ────────────────────────────────────────────────────
  theme: storedOpTheme,
  setTheme: (theme) => {
    localStorage.setItem('argus_op_theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
    set({ theme })
  },

  // ── Auth ────────────────────────────────────────────────────
  user:  JSON.parse(localStorage.getItem('argus_op_user') || 'null'),
  token: localStorage.getItem('argus_op_token') || null,

  login: ({ token, user }) => {
    localStorage.setItem('argus_op_token', token)
    localStorage.setItem('argus_op_user', JSON.stringify(user))
    set({ token, user })
  },

  logout: () => {
    localStorage.removeItem('argus_op_user')
    localStorage.removeItem('argus_op_token')
    set({ user: null, token: null, fleet: [] })
  },

  // ── Fleet (datos reales del backend) ──────────────────────────────────────
  /**
   * fleet: array aplanado de dispositivos con info del usuario y moto.
   * Cada item: { deviceId, email, plan, alias, placa, marca, modelo,
   *              connected, lat, lon, speed, lastSeen, armed }
   *
   * Se pobla desde GET /api/fleet (datos PostgreSQL + estado TCP en tiempo real).
   * Los campos GPS (lat, lon, speed, lastSeen) se actualizan con socket.io.
   */
  fleet: [],

  /**
   * @brief Carga la flota desde el backend y la aplana en el formato del store.
   *
   * La respuesta de /api/fleet tiene estructura jerárquica:
   *   [ { userId, email, plan, motos: [ { id, alias, deviceId, connected } ] } ]
   * Este setter la aplana a un array de dispositivos para simplificar el consumo
   * en DashboardPage, MapPage y DevicesPage.
   *
   * @param {Array} users  Respuesta de GET /api/fleet
   */
  setFleet: (users) => {
    const flat = []
    for (const user of users) {
      for (const moto of user.motos) {
        if (moto.deviceId) {
          flat.push({
            deviceId:  moto.deviceId,
            email:     user.email,
            plan:      user.plan,
            alias:     moto.alias ?? '—',
            placa:     moto.placa ?? '—',
            marca:     moto.marca ?? '—',
            modelo:    moto.modelo ?? '—',
            connected: moto.connected ?? false,
            armed:     false,
            lat:       null,
            lon:       null,
            speed:     null,
            lastSeen:  null,
          })
        }
      }
    }
    set({ fleet: flat })
  },

  /**
   * @brief Actualiza los campos de un dispositivo específico en la flota.
   * Usado para actualizaciones de GPS desde socket.io y de estado desde
   * la respuesta de /api/device/:id/status.
   *
   * @param {string} deviceId  ID del ESP32
   * @param {object} data      Campos a actualizar (parcial)
   */
  updateDevice: (deviceId, data) =>
    set((s) => ({
      fleet: s.fleet.map((d) => d.deviceId === deviceId ? { ...d, ...data } : d),
    })),

  // ── Alerts ────────────────────────────────────────────────
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) => set((s) => ({ alerts: [alert, ...s.alerts].slice(0, 200) })),
  acknowledgeAlertLocal: (alertId) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a._id === alertId ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() } : a
      ),
    })),

  // ── Selected device ───────────────────────────────────────
  selectedDevice: null,
  selectDevice: (deviceId) => set({ selectedDevice: deviceId }),
}))
