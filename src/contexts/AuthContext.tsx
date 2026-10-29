import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AUTH_TOKEN_KEY, SESSION_CHANGED_EVENT, endSession, tokenExpiresAt, tokenHasExpired } from '@/lib/authSession';

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => {
    const saved = localStorage.getItem(AUTH_TOKEN_KEY);
    if (saved && tokenHasExpired(saved)) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      return null;
    }
    return saved;
  });

  const isAuthenticated = !!token && !tokenHasExpired(token);

  useEffect(() => {
    let timer: number | undefined;
    const sync = () => {
      const stored = localStorage.getItem(AUTH_TOKEN_KEY);
      if (stored && tokenHasExpired(stored)) {
        endSession(stored);
        return;
      }
      if (stored !== token) {
        void queryClient.cancelQueries();
        queryClient.clear();
        setToken(stored);
      }
    };
    const checkExpiry = () => {
      sync();
      if (!token || localStorage.getItem(AUTH_TOKEN_KEY) !== token) return;
      const expires = tokenExpiresAt(token);
      if (expires !== null) {
        // Browsers clamp longer timers; re-check when the maximum delay elapses.
        timer = window.setTimeout(checkExpiry, Math.max(0, Math.min(expires - Date.now(), 2147483647)));
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_TOKEN_KEY || event.key === null) sync();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    window.addEventListener(SESSION_CHANGED_EVENT, sync);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVisible);
    checkExpiry();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(SESSION_CHANGED_EVENT, sync);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, queryClient]);

  const login = (newToken: string) => {
    queryClient.clear();
    setToken(newToken);
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
  };

  const logout = () => {
    endSession();
  };

  return (
    <AuthContext.Provider value={{ token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
