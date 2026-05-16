import { useContext } from 'react';
import { TelegramContext, type TelegramContextValue } from '../context/TelegramContext';
import {
  BROWSER_FALLBACK_USER,
  getTelegramUser,
  getTelegramWebApp,
  hapticImpact,
  hapticNotification,
  hapticSelection,
  isTelegramMiniApp,
  telegramMainButton,
} from '../lib/telegramWebApp';

const browserFallback: TelegramContextValue = {
  isReady: true,
  isTelegram: false,
  user: BROWSER_FALLBACK_USER,
  webApp: undefined,
  themeParams: null,
  hapticImpact,
  hapticNotification,
  hapticSelection,
  mainButton: telegramMainButton,
};

/**
 * Safe Telegram Mini App hook.
 * Works outside provider — returns browser fallback (no throw).
 */
export function useTelegram(): TelegramContextValue {
  const context = useContext(TelegramContext);

  if (context) {
    return context;
  }

  return {
    ...browserFallback,
    user: getTelegramUser(),
    webApp: getTelegramWebApp(),
    isTelegram: isTelegramMiniApp(),
  };
}
