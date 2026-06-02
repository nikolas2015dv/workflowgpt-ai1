const { Client, APIResponseError } = require('@notionhq/client');

const NOTION_TEXT_LIMIT = 2000;
const NOTION_BLOCKS_PER_REQUEST = 100;

class NotionExportError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'NotionExportError';
    this.code = code;
    this.status = status;
  }
}

function normalizeNotionId(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';

  const fromUrl = trimmed.match(
    /([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})/i
  );
  const candidate = (fromUrl ? fromUrl[1] : trimmed).replace(/-/g, '');

  if (!/^[0-9a-f]{32}$/i.test(candidate)) return trimmed;

  return `${candidate.slice(0, 8)}-${candidate.slice(8, 12)}-${candidate.slice(12, 16)}-${candidate.slice(16, 20)}-${candidate.slice(20)}`;
}

function toRichText(text) {
  const content = String(text ?? '');
  if (!content) return [{ type: 'text', text: { content: ' ' } }];

  const parts = [];
  for (let i = 0; i < content.length; i += NOTION_TEXT_LIMIT) {
    parts.push({
      type: 'text',
      text: { content: content.slice(i, i + NOTION_TEXT_LIMIT) },
    });
  }
  return parts;
}

function isBulletLine(line) {
  return /^(\s*[-*•]\s+|\s*\d+\.\s+)/.test(line);
}

function stripBullet(line) {
  return line.replace(/^\s*[-*•]\s+/, '').replace(/^\s*\d+\.\s+/, '').trim();
}

function markdownToNotionBlocks(markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const blocks = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: toRichText(trimmed.slice(4)) },
      });
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: toRichText(trimmed.slice(3)) },
      });
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: toRichText(trimmed.slice(2)) },
      });
      continue;
    }

    if (isBulletLine(trimmed)) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: toRichText(stripBullet(trimmed)) },
      });
      continue;
    }

    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: toRichText(trimmed) },
    });
  }

  if (blocks.length === 0) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: toRichText('(пустой отчёт)') },
    });
  }

  return blocks;
}

function formatSwot(swot) {
  if (!swot || typeof swot !== 'object') return '';
  const lines = [];
  const labels = [
    ['strengths', 'Сильные стороны'],
    ['weaknesses', 'Слабые стороны'],
    ['opportunities', 'Возможности'],
    ['threats', 'Угрозы'],
  ];
  for (const [key, label] of labels) {
    const items = swot[key];
    if (Array.isArray(items) && items.length) {
      lines.push(`${label}:`, ...items.map((i) => `• ${i}`), '');
    }
  }
  return lines.join('\n').trim();
}

function buildStructuredSectionBlocks(result) {
  if (!result || typeof result !== 'object') return [];

  const blocks = [];
  const entries = [
    ['niche', 'Ниша и рынок'],
    ['offer', 'Оффер и УТП'],
    ['advantages', 'Преимущества'],
    ['summary', 'Резюме'],
    ['insights', 'Инсайты'],
    ['patterns', 'Закономерности'],
    ['anomalies', 'Аномалии'],
    ['risks', 'Риски'],
    ['redFlags', 'Красные флаги'],
    ['recommendations', 'Рекомендации'],
  ];

  for (const [key, title] of entries) {
    const value = result[key];
    if (value == null) continue;

    blocks.push({
      object: 'block',
      type: 'heading_2',
      heading_2: { rich_text: toRichText(title) },
    });

    if (key === 'swot') {
      const text = formatSwot(value);
      if (text) blocks.push(...markdownToNotionBlocks(text));
      continue;
    }

    if (Array.isArray(value) && value.length) {
      for (const item of value) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: { rich_text: toRichText(String(item)) },
        });
      }
      continue;
    }

    const text = String(value).trim();
    if (text) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: toRichText(text) },
      });
    }
  }

  return blocks;
}

async function resolveTitlePropertyName(notion, databaseId) {
  const database = await notion.databases.retrieve({ database_id: databaseId });
  const entries = Object.entries(database.properties ?? {});
  const titleEntry = entries.find(([, prop]) => prop?.type === 'title');
  return titleEntry ? titleEntry[0] : 'Name';
}

function mapNotionError(error) {
  if (error instanceof NotionExportError) return error;

  if (error instanceof APIResponseError) {
    const status = error.status;
    if (status === 401) {
      return new NotionExportError(
        'invalid_token',
        'Неверный Notion Integration Token. Проверьте токен.',
        401
      );
    }
    if (status === 404) {
      return new NotionExportError(
        'invalid_database',
        'База Notion не найдена. Проверьте Database ID и доступ интеграции.',
        404
      );
    }
    if (status === 403) {
      return new NotionExportError(
        'invalid_database',
        'Нет доступа к базе. Добавьте интеграцию в Connections базы Notion.',
        403
      );
    }
    return new NotionExportError('notion_api', error.message ?? 'Notion API error', status ?? 500);
  }

  if (error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT') {
    return new NotionExportError('network', 'Сеть недоступна. Повторите позже.', 503);
  }

  return new NotionExportError('unknown', error?.message ?? 'Notion export failed', 500);
}

/**
 * @param {{
 *   notionApiKey: string;
 *   databaseId: string;
 *   title: string;
 *   report: string;
 *   workflowType: string;
 *   subject?: string;
 *   createdAt?: number;
 *   result?: object;
 * }} params
 */
async function exportToNotion({
  notionApiKey,
  databaseId,
  title,
  report,
  workflowType,
  subject,
  createdAt,
  result,
}) {
  const apiKey = String(notionApiKey ?? '').trim();
  const dbRaw = String(databaseId ?? '').trim();

  if (!apiKey) throw new NotionExportError('invalid_token', 'Укажите Notion Integration Token', 400);
  if (!dbRaw) throw new NotionExportError('invalid_database', 'Укажите Database ID', 400);

  const normalizedDbId = normalizeNotionId(dbRaw);
  const pageTitle = String(title ?? 'WorkflowGPT Report').trim() || 'WorkflowGPT Report';
  const reportBody = String(report ?? '').trim();
  const workflowLabel = String(workflowType ?? 'workflow').trim();
  const subjectLabel = String(subject ?? '').trim();
  const createdLabel = new Date(createdAt ?? Date.now()).toLocaleString('ru-RU');

  console.log('[Notion Export]', { workflowType: workflowLabel, databaseId: normalizedDbId });

  const notion = new Client({ auth: apiKey });

  try {
    const titleProperty = await resolveTitlePropertyName(notion, normalizedDbId);

    const introBlocks = [
      {
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: toRichText(pageTitle) },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: toRichText(`Тип workflow: ${workflowLabel}`) },
      },
    ];

    if (subjectLabel) {
      introBlocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: toRichText(`Объект: ${subjectLabel}`) },
      });
    }

    introBlocks.push(
      {
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: toRichText(`Дата: ${createdLabel}`) },
      },
      { object: 'block', type: 'divider', divider: {} },
      {
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: toRichText('Итоговый отчёт') },
      }
    );

    const reportBlocks = markdownToNotionBlocks(reportBody);
    const structuredBlocks = buildStructuredSectionBlocks(result);

    if (structuredBlocks.length > 0) {
      structuredBlocks.unshift({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: toRichText('Структурированные секции') },
      });
    }

    const children = [...introBlocks, ...reportBlocks, ...structuredBlocks];
    const firstChunk = children.slice(0, NOTION_BLOCKS_PER_REQUEST);
    const restChunks = [];
    for (let i = NOTION_BLOCKS_PER_REQUEST; i < children.length; i += NOTION_BLOCKS_PER_REQUEST) {
      restChunks.push(children.slice(i, i + NOTION_BLOCKS_PER_REQUEST));
    }

    const page = await notion.pages.create({
      parent: { database_id: normalizedDbId },
      properties: {
        [titleProperty]: {
          title: toRichText(pageTitle),
        },
      },
      children: firstChunk,
    });

    for (const chunk of restChunks) {
      await notion.blocks.children.append({
        block_id: page.id,
        children: chunk,
      });
    }

    console.log('[Notion Success]', { pageId: page.id, url: page.url });

    return {
      pageId: page.id,
      url: page.url ?? null,
    };
  } catch (error) {
    const mapped = mapNotionError(error);
    console.error('[Notion Error]', mapped.code, mapped.message);
    throw mapped;
  }
}

module.exports = {
  exportToNotion,
  markdownToNotionBlocks,
  NotionExportError,
};
