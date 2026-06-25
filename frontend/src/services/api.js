// frontend/src/services/api.js

import axios from 'axios';

const ACCESS_TOKEN_KEY = 'wh_access_token';
const REFRESH_TOKEN_KEY = 'wh_refresh_token';
const USER_KEY = 'wh_user';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}
export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function setSession({ accessToken, refreshToken, user }) {
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Access tokens are short-lived (15min) by design - this transparently
// refreshes once on a 401 and replays the original request, so the rest
// of the app never has to think about token expiry. Concurrent requests
// that 401 at the same time share a single in-flight refresh call rather
// than each firing their own.
let refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const refreshToken = getRefreshToken();

    if (response?.status === 401 && !config._retried && refreshToken && !config.url?.includes('/auth/refresh')) {
      config._retried = true;
      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${import.meta.env.VITE_API_BASE_URL}/auth/refresh`, { refreshToken })
            .finally(() => {
              refreshPromise = null;
            });
        }
        const { data } = await refreshPromise;
        setSession({ accessToken: data.accessToken });
        config.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(config);
      } catch (refreshErr) {
        clearSession();
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);