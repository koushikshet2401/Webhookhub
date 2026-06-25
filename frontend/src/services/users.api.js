// frontend/src/services/users.api.js

import { api } from './api';

export const usersApi = {
  list: () => api.get('/users').then((r) => r.data),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }).then((r) => r.data),
};