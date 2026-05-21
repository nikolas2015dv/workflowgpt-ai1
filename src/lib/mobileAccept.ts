/** MIME + extension accept string for mobile file pickers (iOS/Android WebView) */
export const MOBILE_ACCEPT = {
  legal:
    '.pdf,.docx,.txt,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png',
  analytics:
    '.csv,.xlsx,.xls,.txt,.docx,.pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,application/pdf',
  competitors:
    '.pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv',
} as const;

export function buildMobileAccept(extensions: string[]): string {
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.csv': 'text/csv',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
  };

  const parts = new Set<string>();
  for (const ext of extensions) {
    parts.add(ext);
    const mime = mimeMap[ext];
    if (mime) parts.add(mime);
  }
  return [...parts].join(',');
}
