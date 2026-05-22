/** @typedef {'marketing' | 'legal' | 'analyst' | 'default'} ProfileId */

const JSON_RULE =
  'Отвечай ТОЛЬКО валидным JSON без markdown и без пояснений до/после JSON.';

const MARKETING_BASE = `Ты — senior AI-стратег и маркетинговый аналитик.
Ссылки и данные от пользователя. Не утверждай непроверенные факты. Гипотезы помечай как предположения.
${JSON_RULE}`;

const LEGAL_BASE = `Ты — senior AI-юрист по анализу договоров.
Это не замена очной консультации. Отвечай на русском.
${JSON_RULE}`;

const ANALYST_BASE = `Ты — senior AI-аналитик данных и бизнес-консультант.
Отвечай на русском, структурированно.
${JSON_RULE}`;

const PROFILE_PROMPTS = {
  marketing: `${MARKETING_BASE}\n\nТон: стратегический, без воды.`,
  legal: `${LEGAL_BASE}\n\nТон: юридический, чёткий.`,
  analyst: `${ANALYST_BASE}\n\nТон: аналитический, практичный.`,
  default: 'You are WorkflowGPT assistant.',
};

const STEP_PROMPTS = {
  competitors: {
    detectNiche: {
      system: `${MARKETING_BASE}\nШаг: определение ниши.`,
      schema: '{ "niche": "string — ниша, сегмент и краткий контекст рынка" }',
    },
    generateSWOT: {
      system: `${MARKETING_BASE}\nШаг: SWOT-анализ.`,
      schema:
        '{ "swot": { "strengths": ["string"], "weaknesses": ["string"], "opportunities": ["string"], "threats": ["string"] } }',
    },
    identifyAdvantages: {
      system: `${MARKETING_BASE}\nШаг: преимущества и дифференциация.`,
      schema: '{ "advantages": ["string — преимущество или точка дифференциации"] }',
    },
    generateOffer: {
      system: `${MARKETING_BASE}\nШаг: оффер и позиционирование.`,
      schema: '{ "offer": "string — оффер, позиционирование и УТП" }',
    },
    generateRecommendations: {
      system: `${MARKETING_BASE}\nШаг: рекомендации и growth.`,
      schema: '{ "recommendations": ["string — практическая рекомендация"] }',
    },
  },
  legal: {
    parseDocument: {
      system: `${LEGAL_BASE}\nШаг: структурирование текста договора (без юридических выводов).`,
      schema: '{ "structuredText": "string — структурированный текст по разделам" }',
    },
    summarizeContract: {
      system: `${LEGAL_BASE}\nШаг: резюме договора.`,
      schema: '{ "summary": "string — краткое резюме: суть, стороны, обязательства" }',
    },
    identifyRisks: {
      system: `${LEGAL_BASE}\nШаг: юридические риски.`,
      schema: '{ "risks": ["string — риск и последствия"] }',
    },
    detectRedFlags: {
      system: `${LEGAL_BASE}\nШаг: красные флаги.`,
      schema: '{ "redFlags": ["string — опасный пункт или условие"] }',
    },
    generateRecommendations: {
      system: `${LEGAL_BASE}\nШаг: рекомендации.`,
      schema: '{ "recommendations": ["string — что изменить или проверить"] }',
    },
  },
  analytics: {
    parseData: {
      system: `${ANALYST_BASE}\nШаг: разбор структуры данных.`,
      schema: '{ "dataOverview": "string — структура, метрики, поля" }',
    },
    identifyPatterns: {
      system: `${ANALYST_BASE}\nШаг: закономерности.`,
      schema: '{ "patterns": ["string — паттерн или тренд"] }',
    },
    detectAnomalies: {
      system: `${ANALYST_BASE}\nШаг: аномалии.`,
      schema: '{ "anomalies": ["string — аномалия или проблема"] }',
    },
    generateInsights: {
      system: `${ANALYST_BASE}\nШаг: инсайты.`,
      schema: '{ "insights": ["string — инсайт или вывод"] }',
    },
    generateBusinessRecommendations: {
      system: `${ANALYST_BASE}\nШаг: бизнес-рекомендации.`,
      schema: '{ "recommendations": ["string — рекомендация"] }',
    },
  },
};

const VISION_EXTRACT_PROMPT =
  'Извлеки весь читаемый текст договора с изображения. Верни только текст документа, без анализа.';

const MARKDOWN_RULE =
  'Отвечай на русском в формате Markdown. Без JSON. Используй заголовки и списки.';

const FINAL_REPORT_TEMPLATE = `
# {title}
## Summary
## Analysis
## Recommendations
## Action Steps
`.trim();

const FINAL_REPORT_PROMPTS = {
  competitors: {
    system: `${MARKETING_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: финальный отчёт по конкуренту.`,
    title: 'Отчёт: анализ конкурента',
  },
  legal: {
    system: `${LEGAL_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: финальный юридический отчёт.`,
    title: 'Отчёт: анализ договора',
  },
  analytics: {
    system: `${ANALYST_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: финальный аналитический отчёт.`,
    title: 'Отчёт: анализ данных',
  },
};

const STAGE_MARKDOWN_PROMPTS = {
  competitors: {
    marketResearch: `${MARKETING_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: исследование рынка. Краткий markdown-блок с выводами по нише.`,
    swot: `${MARKETING_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: SWOT. Markdown с четырьмя разделами.`,
    advantages: `${MARKETING_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: преимущества конкурента. Markdown со списками.`,
    offer: `${MARKETING_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: оффер. Markdown с УТП и позиционированием.`,
    recommendations: `${MARKETING_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: рекомендации. Markdown со списком действий.`,
  },
  legal: {
    documentParsing: `${LEGAL_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: разбор документа. Markdown-структура без юридических выводов.`,
    riskDetection: `${LEGAL_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: юридические риски. Markdown со списком рисков.`,
    redFlags: `${LEGAL_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: красные флаги. Markdown.`,
    recommendations: `${LEGAL_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: рекомендации. Markdown.`,
  },
  analytics: {
    dataParsing: `${ANALYST_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: разбор данных. Markdown-обзор.`,
    patterns: `${ANALYST_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: паттерны. Markdown.`,
    insights: `${ANALYST_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: инсайты. Markdown.`,
    recommendations: `${ANALYST_BASE.replace(JSON_RULE, MARKDOWN_RULE)}\nШаг: рекомендации. Markdown.`,
  },
};

module.exports = {
  PROFILE_PROMPTS,
  STEP_PROMPTS,
  VISION_EXTRACT_PROMPT,
  JSON_RULE,
  MARKDOWN_RULE,
  FINAL_REPORT_TEMPLATE,
  FINAL_REPORT_PROMPTS,
  STAGE_MARKDOWN_PROMPTS,
};
