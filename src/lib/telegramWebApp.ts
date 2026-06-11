export interface TelegramUser {
  id: number;
  username: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
}

export const BROWSER_FALLBACK_USER: TelegramUser = {
  id: 0,
  username: 'guest',
  first_name: 'Гость',
};

const TELEGRAM_SCRIPT_URL = 'https://telegram.org/js/telegram-web-app.js';

const THEME_MAP: Record<string, string> = {
  bg_color: '--tg-bg',
  secondary_bg_color: '--tg-secondary',
  text_color: '--tg-text',
  hint_color: '--tg-hint',
  link_color: '--tg-link',
  button_color: '--tg-button',
  button_text_color: '--tg-button-text',
  accent_text_color: '--tg-accent',
};

export function getTelegramWebApp() {
  return window.Telegram?.WebApp;
}

export function isTelegramMiniApp(): boolean {
  const tg = getTelegramWebApp();
  return Boolean(tg?.initData || tg?.initDataUnsafe?.user?.id);
}

export function parseTelegramUser(): TelegramUser | null {
  const raw = getTelegramWebApp()?.initDataUnsafe?.user;
  if (!raw?.id) return null;

  return {
    id: raw.id,
    username: raw.username ?? '',
    first_name: raw.first_name?.trim() || 'Пользователь',
    last_name: raw.last_name?.trim() || undefined,
    photo_url: raw.photo_url?.trim() || undefined,
  };
}

export function getTelegramUser(): TelegramUser {
  return parseTelegramUser() ?? BROWSER_FALLBACK_USER;
}

function applyFormFieldColors(): void {
  const root = document.documentElement;
  root.style.setProperty('--field-text', '#ffffff');
  root.style.setProperty('--field-placeholder', '#a0a0a0');
}

export function applyTelegramTheme(): void {
  const themeParams = getTelegramWebApp()?.themeParams;
  const root = document.documentElement;

  if (themeParams) {
    Object.entries(THEME_MAP).forEach(([key, cssVar]) => {
      const value = themeParams[key as keyof typeof themeParams];
      if (typeof value === 'string' && value.length > 0) {
        root.style.setProperty(cssVar, value);
      }
    });

    if (themeParams.bg_color) {
      root.style.setProperty('--tg-theme-bg-color', themeParams.bg_color);
    }
    if (themeParams.text_color) {
      root.style.setProperty('--tg-theme-text-color', themeParams.text_color);
    }
    if (themeParams.button_color) {
      root.style.setProperty('--tg-theme-button-color', themeParams.button_color);
    }
  }

  applyFormFieldColors();
}

export function configureTelegramViewport(): void {
  const tg = getTelegramWebApp();
  if (!tg) return;

  try {
    tg.ready?.();
    tg.expand?.();

    if (typeof tg.disableVerticalSwipes === 'function') {
      tg.disableVerticalSwipes();
    }

    if (typeof tg.enableClosingConfirmation === 'function') {
      tg.enableClosingConfirmation();
    }

    const bg = tg.themeParams?.bg_color ?? '#0a0a0c';
    tg.setHeaderColor?.(bg);
    tg.setBackgroundColor?.(bg);

    document.documentElement.classList.add('tg-mini-app');
    document.body.classList.add('tg-mini-app');

    const vh = tg.viewportStableHeight ?? tg.viewportHeight;
    if (vh && vh > 0) {
      document.documentElement.style.setProperty('--tg-viewport-height', `${vh}px`);
    }
  } catch {
    /* ignore */
  }
}

export function initTelegramWebApp(): boolean {
  const tg = getTelegramWebApp();
  if (!tg) return false;

  try {
    configureTelegramViewport();
    applyTelegramTheme();
    return true;
  } catch {
    return false;
  }
}

function loadTelegramScript(): Promise<void> {
  if (getTelegramWebApp()) {
    return Promise.resolve();
  }

  const existing = document.querySelector<HTMLScriptElement>('script[data-telegram-web-app]');
  if (existing) {
    return new Promise((resolve) => {
      if (getTelegramWebApp()) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => resolve(), { once: true });
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = TELEGRAM_SCRIPT_URL;
    script.defer = true;
    script.dataset.telegramWebApp = 'true';
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

let themeListenerAttached = false;

export function attachThemeListener(): void {
  if (themeListenerAttached) return;

  const tg = getTelegramWebApp();
  if (!tg?.onEvent) return;

  try {
    tg.onEvent('themeChanged', applyTelegramTheme);
    themeListenerAttached = true;
  } catch {
    /* ignore */
  }
}

export function detachThemeListener(): void {
  if (!themeListenerAttached) return;

  const tg = getTelegramWebApp();
  try {
    tg?.offEvent?.('themeChanged', applyTelegramTheme);
  } catch {
    /* ignore */
  }
  themeListenerAttached = false;
}

export async function setupTelegramWebApp(): Promise<boolean> {
  try {
    if (initTelegramWebApp()) {
      attachThemeListener();
      return true;
    }
    await loadTelegramScript();
    const ok = initTelegramWebApp();
    if (ok) attachThemeListener();
    return ok;
  } catch {
    return false;
  }
}

/* ─── Haptic ─── */

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    getTelegramWebApp()?.HapticFeedback?.impactOccurred?.(style);
  } catch {
    /* browser fallback: no-op */
  }
}

export function hapticNotification(type: 'success' | 'warning' | 'error'): void {
  try {
    getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.(type);
  } catch {
    /* browser fallback: no-op */
  }
}

export function hapticSelection(): void {
  try {
    getTelegramWebApp()?.HapticFeedback?.selectionChanged?.();
  } catch {
    /* browser fallback: no-op */
  }
}

/* ─── MainButton ─── */

type MainButtonClickHandler = () => void;
const mainButtonHandlers = new Set<MainButtonClickHandler>();

function getMainButton() {
  return getTelegramWebApp()?.MainButton;
}

export const telegramMainButton = {
  setText(text: string): void {
    const btn = getMainButton();
    btn?.setParams?.({ text, is_visible: btn.isVisible });
    btn?.setText?.(text);
  },

  show(): void {
    getMainButton()?.show?.();
  },

  hide(): void {
    getMainButton()?.hide?.();
  },

  enable(): void {
    getMainButton()?.enable?.();
  },

  disable(): void {
    getMainButton()?.disable?.();
  },

  showProgress(leaveActive = false): void {
    getMainButton()?.showProgress?.(leaveActive);
  },

  hideProgress(): void {
    getMainButton()?.hideProgress?.();
  },

  onClick(handler: MainButtonClickHandler): void {
    if (mainButtonHandlers.has(handler)) return;
    mainButtonHandlers.add(handler);
    getMainButton()?.onClick?.(handler);
  },

  offClick(handler: MainButtonClickHandler): void {
    if (!mainButtonHandlers.has(handler)) return;
    mainButtonHandlers.delete(handler);
    getMainButton()?.offClick?.(handler);
  },

  isAvailable(): boolean {
    return Boolean(getMainButton()?.show);
  },
};
