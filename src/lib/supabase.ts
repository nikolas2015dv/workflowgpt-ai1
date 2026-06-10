import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WorkflowHistoryRow } from '../types/database';

export type WorkflowHistoryDatabase = {
  public: {
    Tables: {
      workflow_history: {
        Row: WorkflowHistoryRow;
        Insert: WorkflowHistoryRow;
        Update: Partial<WorkflowHistoryRow>;
      };
    };
  };
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

let client: SupabaseClient<WorkflowHistoryDatabase> | null = null;

export function isSupabaseConfigured(): boolean {
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
}

/** Browser Supabase client (anon key). Primary history I/O goes through backend API. */
export function getSupabase(): SupabaseClient<WorkflowHistoryDatabase> | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient<WorkflowHistoryDatabase>(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
