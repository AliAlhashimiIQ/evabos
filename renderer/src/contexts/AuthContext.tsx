import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { LoginResponse, CurrentUser } from '../types/electron';

interface AuthContextType {
  user: CurrentUser | null;
  token: string | null;
  posLocked: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshPosLock: () => Promise<void>;
  lockPos: () => Promise<void>;
  unlockPos: () => Promise<void>;
  hasRole: (roles: Array<'admin' | 'manager' | 'cashier'>) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'eva_pos_token';

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY));
  const [posLocked, setPosLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!token || !window.evaApi) {
      setUser(null);
      return;
    }
    try {
      const currentUser = await window.evaApi.auth.getCurrentUser(token);
      setUser(currentUser);
    } catch {
      setUser(null);
      setToken(null);
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  const refreshPosLock = useCallback(async () => {
    if (!window.evaApi) return;
    try {
      const status = await window.evaApi.auth.getPosLockStatus();
      setPosLocked(status.locked);
    } catch {
      // Ignore errors
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (token) {
        await refreshUser();
      }
      await refreshPosLock();
      setLoading(false);
    };
    init();
  }, [token, refreshUser, refreshPosLock]);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    if (!window.evaApi) return false;
    try {
      const response: LoginResponse | null = await window.evaApi.auth.login(username, password);
      if (response) {
        setToken(response.token);
        localStorage.setItem(TOKEN_KEY, response.token);
        setUser({
          userId: response.userId,
          username: response.username,
          role: response.role,
          branchId: response.branchId,
        });
        await refreshPosLock();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [refreshPosLock]);

  const logout = useCallback(async () => {
    if (token && window.evaApi) {
      try {
        await window.evaApi.auth.logout(token);
      } catch {
        // Ignore errors
      }
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    await refreshPosLock();
  }, [token, refreshPosLock]);

  const lockPos = useCallback(async () => {
    if (!token || !window.evaApi) return;
    try {
      await window.evaApi.auth.lockPos(token);
      await refreshPosLock();
    } catch (err) {
      console.error('Failed to lock POS:', err);
    }
  }, [token, refreshPosLock]);

  const unlockPos = useCallback(async () => {
    if (!token || !window.evaApi) return;
    try {
      await window.evaApi.auth.unlockPos(token);
      await refreshPosLock();
    } catch (err) {
      console.error('Failed to unlock POS:', err);
    }
  }, [token, refreshPosLock]);

  const hasRole = useCallback(
    (roles: Array<'admin' | 'manager' | 'cashier'>): boolean => {
      return user ? roles.includes(user.role) : false;
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        posLocked,
        loading,
        login,
        logout,
        refreshUser,
        refreshPosLock,
        lockPos,
        unlockPos,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

