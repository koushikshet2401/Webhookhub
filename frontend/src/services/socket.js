// frontend/src/services/socket.js

import { io } from 'socket.io-client';

export const socket = io(import.meta.env.VITE_SOCKET_URL, {
  autoConnect: false,
});

// Matches the backend's room pattern in src/sockets/index.js -
// joining a project's room means only that project's delivery_update
// events reach this client, not every project's.
export function joinProjectRoom(projectId) {
  if (!socket.connected) socket.connect();
  socket.emit('join_project', projectId);
}