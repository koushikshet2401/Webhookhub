// backend/src/utils/audit.js
const prisma = require('../config/db');

async function logAction({ userId, action, targetType, targetId, metadata }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        targetType,
        targetId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

module.exports = { logAction };
