// frontend/src/context/AuthContext.jsx

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/auth.api';
import { getStoredUser, getAccessToken, setSession, clearSession } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // No server-side "who am I" endpoint to call on load - the stored
    // user + presence of an access token is enough to render optimistically.
    // A request that actually needs auth will 401 -> refresh -> retry via
    // the interceptor, or bounce to /login if the refresh token is gone too.
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });
    setSession(data);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const data = await authApi.register({ name, email, password });
    setSession(data);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getAccessToken()) await authApi.logout();
    } catch {
      // Even if the server call fails (token already expired, network
      // blip), still clear the local session - the user clicked logout,
      // it should not be possible for that to silently fail.
    }
    clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}