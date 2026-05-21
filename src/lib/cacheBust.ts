import { BUILD_ID, BUILD_TIMESTAMP } from '../config/buildInfo';
import { logMobile } from './mobileDebug';

const STORAGE_KEY = 'workflowgpt_build_id';
const RELOAD_GUARD_KEY = 'workflowgpt_reload_guard';

/**
 * Detect new deploy and force WebView to fetch fresh index.html + bundles.
 */
export function initCacheBust(): void {
  logMobile(`[WorkflowGPT] build version: ${BUILD_TIMESTAMP}`);

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const reloadGuard = sessionStorage.getItem(RELOAD_GUARD_KEY);

    if (stored && stored !== BUILD_ID && reloadGuard !== BUILD_ID) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, BUILD_ID);
      localStorage.setItem(STORAGE_KEY, BUILD_ID);
      forceHardReload();
      return;
    }

    localStorage.setItem(STORAGE_KEY, BUILD_ID);
    sessionStorage.removeItem(RELOAD_GUARD_KEY);

    syncUrlBuildParam();
  } catch (err) {
    logMobile('[WorkflowGPT] cache bust skipped', err);
  }
}

function forceHardReload(): void {
  const url = new URL(window.location.href);
  url.searchParams.set('v', BUILD_ID);
  url.searchParams.set('_ts', String(Date.now()));
  logMobile('[WorkflowGPT] new deploy detected, reloading', BUILD_ID);
  window.location.replace(url.toString());
}

function syncUrlBuildParam(): void {
  const url = new URL(window.location.href);
  const current = url.searchParams.get('v');

  if (current === BUILD_ID) return;

  url.searchParams.set('v', BUILD_ID);
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', next);
}

/**
 * Telegram WebView: re-expand and hint platform after fresh load.
 */
export function applyTelegramCacheRefresh(): void {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  try {
    tg.ready?.();
    tg.expand?.();
    logMobile('[WorkflowGPT] Telegram WebView refreshed', {
      platform: tg.platform,
      version: tg.version,
      build: BUILD_ID,
    });
  } catch {
    /* ignore */
  }
}
