/**
 * AuthContext — session state + RBAC helpers.
 *
 * Reads the token from localStorage (set by the API layer after login/register),
 * restores the current user on app start, and exposes role-based helpers
 * (isAdmin / canApprove) used by the UI.
 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import * as api from '../services/api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  /** Platform Administrators and staff can manage users/libraries and approve assessments. */
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (payload: Parameters<typeof api.register>[0]) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(() => api.getToken());
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const stored = api.getToken();
    if (!stored) {
      setUser(null);
      setLoading(false);
      return;
    }
    setTokenState(stored);
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      api.clearToken();
      setTokenState(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    setTokenState(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (payload: Parameters<typeof api.register>[0]) => {
    const res = await api.register(payload);
    setTokenState(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setTokenState(null);
    setUser(null);
  }, []);

  const isAdmin = Boolean(
    user?.is_staff ||
    user?.profile?.role_code === 'PLATFORM_ADMIN' ||
    user?.profile?.is_admin
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: Boolean(user),
        isAdmin,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}