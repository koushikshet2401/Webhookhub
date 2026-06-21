// backend/src/controllers/user.controller.js

const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

const VALID_ROLES = ['ADMIN', 'DEVELOPER', 'VIEWER'];

async function listUsers(req, res) {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(users);
}

async function updateUserRole(req, res) {
  const id = Number(req.params.id);
  const { role } = req.body;

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'User not found' });

  // Prevent an admin from demoting themselves and locking everyone out
  if (target.id === req.user.id && role !== 'ADMIN') {
    return res.status(400).json({ error: 'You cannot change your own role away from ADMIN' });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });

  await logAction({
    userId: req.user.id,
    action: 'user.role_change',
    targetType: 'User',
    targetId: id,
    metadata: { from: target.role, to: role },
  });

  return res.json(updated);
}

module.exports = { listUsers, updateUserRole };