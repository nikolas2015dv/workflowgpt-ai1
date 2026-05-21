import type { ResultSectionConfig, SwotData } from '../types/workflowResult';

export function isSwot(value: unknown): value is SwotData {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('strengths' in value || 'weaknesses' in value)
  );
}

export function sectionHasContent(value: unknown, type: ResultSectionConfig['type']): boolean {
  if (type === 'swot' && isSwot(value)) {
    return (
      value.strengths?.length > 0 ||
      value.weaknesses?.length > 0 ||
      value.opportunities?.length > 0 ||
      value.threats?.length > 0
    );
  }
  if (type === 'list' && Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value != null;
}

export function buildCopyText(
  workflow: string,
  result: Record<string, unknown>,
  sections: ResultSectionConfig[],
  reply: string
): string {
  if (reply.trim()) return reply;

  const lines = [`WorkflowGPT — ${workflow}`, ''];
  for (const { key, title, type } of sections) {
    const value = result[key];
    if (!sectionHasContent(value, type)) continue;

    lines.push(title, '');
    if (type === 'list' && Array.isArray(value)) {
      value.forEach((item) => lines.push(`• ${String(item)}`));
    } else if (type === 'swot' && isSwot(value)) {
      const blocks: [string, string[] | undefined][] = [
        ['Сильные стороны', value.strengths],
        ['Слабые стороны', value.weaknesses],
        ['Возможности', value.opportunities],
        ['Угрозы', value.threats],
      ];
      for (const [label, items] of blocks) {
        if (items?.length) {
          lines.push(label);
          items.forEach((i) => lines.push(`• ${i}`));
        }
      }
    } else {
      lines.push(String(value));
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}
