import type { HistoryItem } from '../types/history';
import type { DatabaseHealthResponse, LoadWorkflowHistoryResult } from '../types/database';
import { apiUrl, mapFetchError } from './api';
import { readHistoryFromLocalStorage } from '../services/historyLocalStorage';
import { logError, logMobile } from './mobileDebug';

async function parseJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthResponse> {
  try {
    const response = await fetch(apiUrl('/api/database/health'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const data = await parseJson<DatabaseHealthResponse>(response);
    if (response.ok && data.status === 'ok') {
      return { status: 'ok' };
    }
    return {
      status: 'unavailable',
      message: data.message ?? `HTTP ${response.status}`,
    };
  } catch (e) {
    logError('database-health', e);
    return {
      status: 'unavailable',
      message: e instanceof Error ? e.message : 'Network error',
    };
  }
}

export async function saveWorkflowToDatabase(item: HistoryItem): Promise<boolean> {
  try {
    logMobile('history db save', item.id);
    const response = await fetch(apiUrl('/api/history'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ item }),
    });

    if (!response.ok) {
      const data = await parseJson<{ message?: string; skipped?: boolean }>(response);
      if (data.skipped) return false;
      logError('history-db-save', data.message ?? response.status);
      return false;
    }

    return true;
  } catch (e) {
    logError('history-db-save', e);
    return false;
  }
}

export async function loadWorkflowHistory(): Promise<LoadWorkflowHistoryResult> {
  try {
    const response = await fetch(apiUrl('/api/history'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const data = await parseJson<{ items?: HistoryItem[]; skipped?: boolean; message?: string }>(response);

    if (response.ok) {
      if (data.skipped) {
        return {
          items: readHistoryFromLocalStorage(),
          source: 'local',
        };
      }
      if (Array.isArray(data.items)) {
        logMobile('history db load', data.items.length);
        return {
          items: data.items.sort((a, b) => b.createdAt - a.createdAt),
          source: 'database',
        };
      }
    }

    if (!response.ok && !data.skipped) {
      throw mapFetchError(new Error(data.message ?? `HTTP ${response.status}`));
    }
  } catch (e) {
    logError('history-db-load', e);
    const localItems = readHistoryFromLocalStorage();
    return {
      items: localItems,
      source: 'local',
      error: e instanceof Error ? e.message : 'Database unavailable',
    };
  }

  return {
    items: readHistoryFromLocalStorage(),
    source: 'local',
  };
}

export async function deleteWorkflowHistory(id: string): Promise<boolean> {
  try {
    const response = await fetch(apiUrl(`/api/history/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });

    if (response.ok) return true;

    const data = await parseJson<{ skipped?: boolean }>(response);
    return data.skipped === true;
  } catch (e) {
    logError('history-db-delete', e);
    return false;
  }
}

export async function clearWorkflowHistoryDatabase(): Promise<boolean> {
  try {
    const response = await fetch(apiUrl('/api/history'), {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });

    if (response.ok) return true;

    const data = await parseJson<{ skipped?: boolean }>(response);
    return data.skipped === true;
  } catch (e) {
    logError('history-db-clear', e);
    return false;
  }
}
