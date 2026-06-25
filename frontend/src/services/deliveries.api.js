// frontend/src/services/deliveries.api.js

import { api } from './api';

export const deliveriesApi = {
  list: (projectId, params) => api.get(`/projects/${projectId}/deliveries`, { params }).then((r) => r.data),
  get: (id) => api.get(`/deliveries/${id}`).then((r) => r.data),
  replay: (id) => api.post(`/deliveries/${id}/replay`).then((r) => r.data),
};