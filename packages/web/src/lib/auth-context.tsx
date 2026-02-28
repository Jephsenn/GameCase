'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, registerTokenRefreshCallback, type AuthResponseData } from './api';

type User = AuthResponseData['user'];

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string, displayName?: string) => Promise<void>;
  oauthLogin: (token: string, provider: 'google' | 'apple') => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'gt_access_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Persist token in localStorage
  const saveToken = useCallback((token: string | null) => {
    setAccessToken(token);
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  // Keep the api-layer interceptor in sync with the latest saveToken
  useEffect(() => {
    registerTokenRefreshCallback((newToken) => saveToken(newToken));
  }, [saveToken]);

  // Try to restore session on mount
  useEffect(() => {
    const init = async () => {
      try {
        // First try localStorage token
        const storedToken = localStorage.getItem(TOKEN_KEY);
        if (storedToken) {
          const data = await authApi.me(storedToken);
          setUser(data.user);
          // Read the latest token from localStorage — silentRefresh() may have
          // rotated the access token during the me() call if it was expired.
          const latestToken = localStorage.getItem(TOKEN_KEY) || storedToken;
          setAccessToken(latestToken);
          setIsLoading(false);
          return;
        }

        // Try refresh token (httpOnly cookie)
        const data = await authApi.refresh();
        setUser(data.user);
        saveToken(data.accessToken);
      } catch {
        // Not authenticated — that's fine
        saveToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [saveToken]);

  const loginFn = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.login({ email, password });
      setUser(data.user);
      saveToken(data.accessToken);
    },
    [saveToken],
  );

  const signupFn = useCallback(
    async (email: string, username: string, password: string, displayName?: string) => {
      const data = await authApi.signup({ email, username, password, displayName });
      setUser(data.user);
      saveToken(data.accessToken);
    },
    [saveToken],
  );

  const oauthLoginFn = useCallback(
    async (token: string, provider: 'google' | 'apple') => {
      const data = await authApi.oauth({ token, provider });
      setUser(data.user);
      saveToken(data.accessToken);
    },
    [saveToken],
  );

  const logoutFn = useCallback(async () => {
    try {
      if (accessToken) {
        await authApi.logout(accessToken);
      }
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null);
      saveToken(null);
    }
  }, [accessToken, saveToken]);

  const refreshUser = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await authApi.me(accessToken);
      setUser(data.user);
    } catch {
      // Token might be expired, try refresh
      try {
        const refreshData = await authApi.refresh();
        setUser(refreshData.user);
        saveToken(refreshData.accessToken);
      } catch {
        setUser(null);
        saveToken(null);
      }
    }
  }, [accessToken, saveToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!user,
        login: loginFn,
        signup: signupFn,
        oauthLogin: oauthLoginFn,
        logout: logoutFn,
        setUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
