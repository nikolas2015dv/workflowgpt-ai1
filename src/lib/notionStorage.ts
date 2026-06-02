const API_KEY_KEY = 'workflowgpt_notion_api_key';
const DATABASE_ID_KEY = 'workflowgpt_notion_database_id';

export interface NotionCredentials {
  apiKey: string;
  databaseId: string;
}

export function loadNotionCredentials(): NotionCredentials {
  try {
    return {
      apiKey: localStorage.getItem(API_KEY_KEY) ?? '',
      databaseId: localStorage.getItem(DATABASE_ID_KEY) ?? '',
    };
  } catch {
    return { apiKey: '', databaseId: '' };
  }
}

export function saveNotionCredentials(credentials: NotionCredentials): void {
  try {
    localStorage.setItem(API_KEY_KEY, credentials.apiKey.trim());
    localStorage.setItem(DATABASE_ID_KEY, credentials.databaseId.trim());
  } catch {
    /* private mode / quota */
  }
}

export function clearNotionCredentials(): void {
  try {
    localStorage.removeItem(API_KEY_KEY);
    localStorage.removeItem(DATABASE_ID_KEY);
  } catch {
    /* ignore */
  }
}
