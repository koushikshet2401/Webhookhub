// frontend/src/services/apiKeys.api.js

import { api } from './api';

export const apiKeysApi = {
  list: (projectId) => api.get(`/projects/${projectId}/api-keys`).then((r) => r.data),
  create: (projectId, data) => api.post(`/projects/${projectId}/api-keys`, data).then((r) => r.data),
  revoke: (id) => api.patch(`/api-keys/${id}/revoke`).then((r) => r.data),
  regenerate: (id) => api.post(`/api-keys/${id}/regenerate`).then((r) => r.data),
};