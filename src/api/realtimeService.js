import { io } from 'socket.io-client'

// Dominio oficial de producción — nunca IPs (regla 2026-07-09). Dev: VITE_API_URL en .env.local
const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.argussecure.online'

let socket = null

export const connect = (onGpsUpdate, onStatusUpdate, onAlertNew, onRiskAlert) => {
  if (!socket) {
    socket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      auth: { token: localStorage.getItem('argus_op_token') },
    })
    socket.on('connect',    () => console.log('[RT-OP] conectado'))
    socket.on('disconnect', () => console.log('[RT-OP] desconectado'))
  }

  socket.off('gps:update').off('device:status').off('alert:new')
        .off('risk:zone_enter').off('risk:zone_exit')
  if (onGpsUpdate)    socket.on('gps:update',     onGpsUpdate)
  if (onStatusUpdate) socket.on('device:status',   onStatusUpdate)
  if (onAlertNew)     socket.on('alert:new',        onAlertNew)
  if (onRiskAlert) {
    socket.on('risk:zone_enter', d => onRiskAlert({ ...d, event: 'enter' }))
    socket.on('risk:zone_exit',  d => onRiskAlert({ ...d, event: 'exit'  }))
  }

  if (!socket.connected) socket.connect()
  return socket
}

export const getSocket = () => socket

export const disconnect = () => {
  if (socket) {
    socket.off('gps:update').off('device:status').off('alert:new')
    socket.disconnect()
  }
}
