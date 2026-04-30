import { io, type Socket } from 'socket.io-client'
import { SOCKET_URL } from '../config'

let socket: Socket | null = null

export function createSocket(userId: string): Socket {
  if (socket) {
    socket.disconnect()
  }
  socket = io(SOCKET_URL, {
    query: { userId },
    transports: ['websocket'], // skip polling, go straight to websocket for speed
    reconnection: true,
    reconnectionDelay: 1000,
  })
  return socket
}

export function getSocket(): Socket | null {
  return socket
}
