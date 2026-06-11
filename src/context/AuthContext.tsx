import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  authenticateWithTelegram,
  buildDevAuthPayload,
  buildTelegramAuthPayload,
  fetchCurrentUser,
} from '../lib/authApi';
import { setAuthUser as setSessionUser } from '../lib/authSession';
import { isTelegramMiniApp, parseTelegramUser } from '../lib/telegramWebApp';
import type { AppUser } from '../types/user';
import { logError } from '../lib/mobileDebug';

export interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDevMode: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
  telegramReady: boolean;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, telegramReady }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  const applyUser = useCallback((next: AppUser | null) => {
    setUser(next);
    setSessionUser(next);
  }, []);

  const signIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const tgUser = parseTelegramUser();
      const inTelegram = isTelegramMiniApp() && tgUser;
      const payload = inTelegram ? buildTelegramAuthPayload(tgUser) : buildDevAuthPayload();
      setIsDevMode(!inTelegram);

      const authenticated = await authenticateWithTelegram(payload);
      applyUser(authenticated);
    } catch (e) {
      logError('auth', e);
      applyUser(null);
      setError(e instanceof Error ? e.message : 'Не удалось войти');
    } finally {
      setIsLoading(false);
    }
  }, [applyUser]);

  const refreshUser = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await fetchCurrentUser(user.id);
      applyUser(result.user);
      setError(null);
    } catch (e) {
      logError('auth-refresh', e);
      setError(e instanceof Error ? e.message : 'Не удалось обновить профиль');
    }
  }, [applyUser, user?.id]);

  useEffect(() => {
    if (!telegramReady) return;
    void signIn();
  }, [telegramReady, signIn]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user?.id),
      isDevMode,
      error,
      refreshUser,
    }),
    [user, isLoading, isDevMode, error, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
