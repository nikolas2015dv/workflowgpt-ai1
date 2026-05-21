import type { WorkflowRunResult } from '../types/workflowResult';
import { logError, logMobile } from './mobileDebug';
import { getTelegramWebApp } from './telegramWebApp';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function triggerAnchorDownload(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(link);

    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1500);

    return true;
  } catch (e) {
    logError('download-anchor', e);
    return false;
  }
}

async function shareBlobFile(blob: Blob, filename: string, title: string): Promise<boolean> {
  if (!navigator.share) return false;

  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, files: [file] });
      return true;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return true;
    logError('share-file', e);
  }
  return false;
}

function openBlobInNewTab(blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return Boolean(opened);
  } catch (e) {
    logError('open-tab', e);
    return false;
  }
}

export async function downloadReport(
  run: WorkflowRunResult,
  format: 'pdf' | 'docx'
): Promise<'downloaded' | 'shared' | 'opened' | 'failed'> {
  const filename = `workflowgpt-report.${format}`;
  logMobile('export start', format);

  const response = await fetch(`${API_BASE}/api/export/${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow: run.workflow,
      result: run.result,
      sections: run.sections,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? `Ошибка экспорта (${response.status})`
    );
  }

  const blob = await response.blob();
  const mime =
    format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const fileBlob = blob.type ? blob : new Blob([blob], { type: mime });

  if (await shareBlobFile(fileBlob, filename, `WorkflowGPT — ${run.workflow}`)) {
    logMobile('export via share API');
    return 'shared';
  }

  if (triggerAnchorDownload(fileBlob, filename)) {
    logMobile('export via anchor');
    return 'downloaded';
  }

  if (openBlobInNewTab(fileBlob)) {
    logMobile('export via new tab');
    return 'opened';
  }

  return 'failed';
}

export async function copyReportText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    logError('clipboard', e);
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

export async function shareReport(text: string, title: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text: text.slice(0, 8000) });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
      logError('share-text', e);
    }
  }

  const tg = getTelegramWebApp();
  if (tg?.openTelegramLink) {
    const encoded = encodeURIComponent(text.slice(0, 3500));
    tg.openTelegramLink(`https://t.me/share/url?text=${encoded}`);
    return true;
  }

  return copyReportText(text);
}
