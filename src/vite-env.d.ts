/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Render.com backend URL, e.g. https://workflowgpt-api.onrender.com */
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_BUILD_TIMESTAMP: string;
  readonly VITE_BUILD_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
