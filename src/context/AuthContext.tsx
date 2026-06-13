import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  authenticateWithTelegram,
  buildDevAuthPayload,
  buildTelegramAuthPayload,
  fetchCurrentUser,
} from '../lib/authApi';
import { setAuthUser as setSessionUser } from '../lib/authSession';
import { isTelegramMiniApp, parseTelegramUser } from '../lib/telegramWebApp';
import type { AppUser, UsageQuota, UserRole } from '../types/user';
import type { Subscription, SubscriptionInfo } from '../types/subscription';
import { logError } from '../lib/mobileDebug';

export interface AuthContextValue {
  user: AppUser | null;
  subscription: Subscription | null;
  effectivePlan: UserRole | null;
  usage: UsageQuota | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDevMode: boolean;
  isOwner: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  applySubscriptionResult: (result: SubscriptionInfo & { user: AppUser }) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
  telegramReady: boolean;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, telegramReady }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [effectivePlan, setEffectivePlan] = useState<AppUser['role'] | null>(null);
  const [usage, setUsage] = useState<UsageQuota | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  const applyUser = useCallback((next: AppUser | null) => {
    setUser(next);
    setSessionUser(next);
  }, []);

  const applySession = useCallback(
    (
      nextUser: AppUser | null,
      nextSubscription: Subscription | null = null,
      nextEffectivePlan: AppUser['role'] | null = null,
      nextUsage: UsageQuota | null = null
    ) => {
      applyUser(nextUser);
      setSubscription(nextSubscription);
      setEffectivePlan(nextEffectivePlan);
      setUsage(nextUsage);
    },
    [applyUser]
  );

  const signIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const tgUser = parseTelegramUser();
      const inTelegram = isTelegramMiniApp() && tgUser;
      const payload = inTelegram ? buildTelegramAuthPayload(tgUser) : buildDevAuthPayload();
      setIsDevMode(!inTelegram);

      const authResult = await authenticateWithTelegram(payload);
      applySession(
        authResult.user,
        authResult.subscription ?? null,
        authResult.effectivePlan ?? authResult.user.role,
        authResult.usage ?? null
      );
    } catch (e) {
      logError('auth', e);
      applySession(null);
      setError(e instanceof Error ? e.message : 'Не удалось войти');
    } finally {
      setIsLoading(false);
    }
  }, [applyUser]);

  const applySubscriptionResult = useCallback(
    (result: SubscriptionInfo & { user: AppUser }) => {
      applySession(result.user, result.subscription, result.effectivePlan, result.quota);
      setError(null);
    },
    [applySession]
  );

  const refreshUser = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await fetchCurrentUser(user.id);
      applySession(
        result.user,
        (result as { subscription?: Subscription }).subscription ?? null,
        (result as { effectivePlan?: UserRole }).effectivePlan ?? result.user.role,
        result.usage as UsageQuota
      );
      setError(null);
    } catch (e) {
      logError('auth-refresh', e);
      setError(e instanceof Error ? e.message : 'Не удалось обновить профиль');
    }
  }, [applySession, user?.id]);

  const isOwner = (effectivePlan ?? user?.role) === 'owner';

  useEffect(() => {
    if (!telegramReady) return;
    void signIn();
  }, [telegramReady, signIn]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      subscription,
      effectivePlan,
      usage,
      isLoading,
      isAuthenticated: Boolean(user?.id),
      isDevMode,
      isOwner,
      error,
      refreshUser,
      applySubscriptionResult,
    }),
    [
      user,
      subscription,
      effectivePlan,
      usage,
      isLoading,
      isDevMode,
      isOwner,
      error,
      refreshUser,
      applySubscriptionResult,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
