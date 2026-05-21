/** Injected at build time via vite.config.ts */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.0.0';
export const BUILD_TIMESTAMP = import.meta.env.VITE_BUILD_TIMESTAMP ?? 'dev';
export const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? BUILD_TIMESTAMP;

export function getBuildLabel(): string {
  return `v${APP_VERSION} · ${BUILD_ID}`;
}
