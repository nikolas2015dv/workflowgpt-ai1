/**
 * Production-safe CORS for Vercel frontend + Telegram WebView.
 *
 * Env:
 * - CORS_ORIGIN — comma-separated allowed origins (e.g. https://app.vercel.app)
 * - FRONTEND_URL — single origin alias
 * - NODE_ENV=production — if no origins set, allows *.vercel.app
 */
function parseAllowedOrigins() {
  const raw = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '';
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (list.length > 0) return list;

  if (process.env.NODE_ENV === 'production') {
    return ['https://*.vercel.app'];
  }

  return ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173'];
}

function originMatches(pattern, origin) {
  if (pattern === '*') return true;
  if (pattern === origin) return true;

  if (pattern.startsWith('https://*.') || pattern.startsWith('http://*.')) {
    const suffix = pattern.replace(/^https?:\/\/\*\./, '');
    try {
      const url = new URL(origin);
      return url.hostname === suffix || url.hostname.endsWith(`.${suffix}`);
    } catch {
      return false;
    }
  }

  return false;
}

function createCorsOptions() {
  const allowed = parseAllowedOrigins();

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const ok = allowed.some((pattern) => originMatches(pattern, origin));
      if (ok) {
        callback(null, true);
        return;
      }

      console.warn('[CORS] blocked origin:', origin, 'allowed:', allowed.join(', '));
      callback(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    exposedHeaders: ['Content-Disposition'],
    credentials: true,
    maxAge: 86400,
  };
}

module.exports = { createCorsOptions, parseAllowedOrigins };
