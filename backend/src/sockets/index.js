const { Server } = require('socket.io');

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] client connected: ${socket.id}`);

    // Dashboard joins a room per project to see only that project's deliveries
    socket.on('join_project', (projectId) => {
      socket.join(`project_${projectId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[socket] client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized. Call initSocket(server) first.');
  return io;
}

// Emit a delivery status update to everyone watching this project
function emitDeliveryUpdate(projectId, payload) {
  if (!io) return;
  io.to(`project_${projectId}`).emit('delivery_update', payload);
}

module.exports = { initSocket, getIO, emitDeliveryUpdate };
