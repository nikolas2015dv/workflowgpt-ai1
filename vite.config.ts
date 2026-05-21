import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version?: string };
const BUILD_TIMESTAMP = new Date().toISOString();
const APP_VERSION = pkg.version ?? '1.0.0';
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
  process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 12) ??
  BUILD_TIMESTAMP.replace(/[-:TZ.]/g, '').slice(0, 14);

function injectCacheBustHtml(): import('vite').Plugin {
  const cacheMeta = `
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <meta name="app-build-timestamp" content="${BUILD_TIMESTAMP}" />
    <meta name="app-build-id" content="${BUILD_ID}" />`;

  const tgScript = `https://telegram.org/js/telegram-web-app.js?v=${encodeURIComponent(BUILD_ID)}`;

  return {
    name: 'workflowgpt-cache-bust-html',
    transformIndexHtml(html) {
      let out = html;
      if (!html.includes('Cache-Control')) {
        out = out.replace('<head>', `<head>${cacheMeta}`);
      }
      out = out.replace(
        /https:\/\/telegram\.org\/js\/telegram-web-app\.js(\?[^"']*)?/,
        tgScript
      );
      return out;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), injectCacheBustHtml()],
  base: '/',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
    'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(BUILD_TIMESTAMP),
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
