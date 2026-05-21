/**
 * Central API base URL for all frontend requests.
 * Set VITE_API_URL in Vercel → Environment Variables (Render backend URL, no trailing slash).
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (raw) return raw.replace(/\/$/, '');

  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }

  return '';
}

export function ensureApiConfigured(): string {
  const base = getApiBaseUrl();

  if (!base) {
    throw new Error(
      'VITE_API_URL is not configured. Add your Render backend URL in Vercel environment variables.'
    );
  }

  if (import.meta.env.PROD && /localhost|127\.0\.0\.1/i.test(base)) {
    throw new Error(
      'VITE_API_URL points to localhost in production. Use your public Render URL instead.'
    );
  }

  return base;
}

export const API_REQUEST_TIMEOUT_MS = 300_000;
