// services/socket.js
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io('http://localhost:4200', { transports: ['websocket', 'polling'] });
  }
  return socket;
}
