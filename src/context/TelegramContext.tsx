import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyTelegramTheme,
  BROWSER_FALLBACK_USER,
  detachThemeListener,
  getTelegramUser,
  getTelegramWebApp,
  hapticImpact,
  hapticNotification,
  hapticSelection,
  isTelegramMiniApp,
  parseTelegramUser,
  configureTelegramViewport,
  setupTelegramWebApp,
  telegramMainButton,
  type TelegramUser,
} from '../lib/telegramWebApp';

export interface TelegramContextValue {
  isReady: boolean;
  isTelegram: boolean;
  user: TelegramUser;
  webApp: ReturnType<typeof getTelegramWebApp>;
  themeParams: NonNullable<ReturnType<typeof getTelegramWebApp>>['themeParams'] | null;
  hapticImpact: (style?: 'light' | 'medium' | 'heavy') => void;
  hapticNotification: (type: 'success' | 'warning' | 'error') => void;
  hapticSelection: () => void;
  mainButton: typeof telegramMainButton;
}

export const TelegramContext = createContext<TelegramContextValue | null>(null);

interface TelegramProviderProps {
  children: React.ReactNode;
}

export const TelegramProvider: React.FC<TelegramProviderProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);
  const [user, setUser] = useState<TelegramUser>(BROWSER_FALLBACK_USER);
  const [themeParams, setThemeParams] = useState<TelegramContextValue['themeParams']>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      await setupTelegramWebApp();

      if (cancelled) return;

      const inTelegram = isTelegramMiniApp();
      const tgUser = parseTelegramUser();

      setIsTelegram(inTelegram);
      setUser(tgUser ?? BROWSER_FALLBACK_USER);
      setThemeParams(getTelegramWebApp()?.themeParams ?? null);
      applyTelegramTheme();
      setIsReady(true);
    };

    void init();

    return () => {
      cancelled = true;
      telegramMainButton.hide();
      detachThemeListener();
    };
  }, []);

  const refreshTheme = useCallback(() => {
    applyTelegramTheme();
    setThemeParams(getTelegramWebApp()?.themeParams ?? null);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const tg = getTelegramWebApp();
    if (!tg?.onEvent) return;

    const onThemeChanged = () => refreshTheme();
    const onViewportChanged = () => {
      configureTelegramViewport();
      refreshTheme();
    };

    tg.onEvent('themeChanged', onThemeChanged);
    tg.onEvent('viewportChanged', onViewportChanged);

    return () => {
      tg.offEvent?.('themeChanged', onThemeChanged);
      tg.offEvent?.('viewportChanged', onViewportChanged);
    };
  }, [isReady, refreshTheme]);

  const value = useMemo<TelegramContextValue>(
    () => ({
      isReady,
      isTelegram,
      user,
      webApp: getTelegramWebApp(),
      themeParams,
      hapticImpact,
      hapticNotification,
      hapticSelection,
      mainButton: telegramMainButton,
    }),
    [isReady, isTelegram, user, themeParams]
  );

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
};
