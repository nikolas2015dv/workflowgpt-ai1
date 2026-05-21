const PREFIX = '[WorkflowGPT]';

export function logMobile(...args: unknown[]): void {
  console.log(PREFIX, ...args);
}

export function logUpload(step: string, detail?: unknown): void {
  console.log(`${PREFIX} [upload]`, step, detail ?? '');
}

export function logWorkflow(step: string, detail?: unknown): void {
  console.log(`${PREFIX} [workflow]`, step, detail ?? '');
}

export function logError(scope: string, error: unknown): void {
  console.error(`${PREFIX} [error:${scope}]`, error);
}
