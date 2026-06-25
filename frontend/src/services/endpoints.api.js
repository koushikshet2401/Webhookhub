// frontend/src/services/endpoints.api.js

import { api } from './api';

export const endpointsApi = {
  list: (projectId) => api.get(`/projects/${projectId}/endpoints`).then((r) => r.data),
  get: (id) => api.get(`/endpoints/${id}`).then((r) => r.data),
  create: (projectId, data) => api.post(`/projects/${projectId}/endpoints`, data).then((r) => r.data),
  update: (id, data) => api.put(`/endpoints/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/endpoints/${id}`),
  regenerateSecret: (id) => api.post(`/endpoints/${id}/regenerate-secret`).then((r) => r.data),
  ping: (id) => api.post(`/endpoints/${id}/ping`).then((r) => r.data),
  replayFailed: (id) => api.post(`/endpoints/${id}/replay-failed`).then((r) => r.data),
};