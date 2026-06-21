const fs = require('fs');
const path = require('path');

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
const WELCOME_IMAGE_PATH = path.join(__dirname, '..', 'assets', 'workflow-welcome.png');

const WELCOME_CAPTION = `👋 Привет! Добро пожаловать в Workflow

🎯 Что умеет сервис:

🔍 Анализ конкурентов — изучает рынок, сравнивает конкурентов и показывает точки роста.

📊 Анализ данных — превращает цифры и таблицы в понятные выводы, отчёты и рекомендации.

📄 Анализ договоров — проверяет документы, находит риски и важные условия.

⚡ Выберите нужный инструмент и получите результат за несколько минут.

🔒 Ваши данные используются только для анализа и не передаются третьим лицам.`;

const APPS_VERIFY_RESPONSE = 'apps_f7a3f3';

function getBotToken() {
  return String(process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
}

function getWebAppUrl() {
  return String(process.env.WEBAPP_URL ?? '').trim().replace(/\/$/, '');
}

function isTelegramBotConfigured() {
  return Boolean(getBotToken());
}

function isWebAppUrlConfigured() {
  return Boolean(getWebAppUrl());
}

function isWelcomeReady() {
  return isTelegramBotConfigured() && isWebAppUrlConfigured() && fs.existsSync(WELCOME_IMAGE_PATH);
}

function getWebhookUrl() {
  const explicit = String(process.env.TELEGRAM_WEBHOOK_URL ?? '').trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const renderUrl = String(process.env.RENDER_EXTERNAL_URL ?? '').trim();
  if (renderUrl) {
    return `${renderUrl.replace(/\/$/, '')}/api/telegram/webhook`;
  }

  const publicApiUrl = String(process.env.PUBLIC_API_URL ?? process.env.API_PUBLIC_URL ?? '').trim();
  if (publicApiUrl) {
    return `${publicApiUrl.replace(/\/$/, '')}/api/telegram/webhook`;
  }

  return null;
}

async function callTelegramApi(method, options = {}) {
  const token = getBotToken();
  if (!token) {
    const error = new Error('Telegram bot token is not configured');
    error.code = 'not_configured';
    throw error;
  }

  const response = await fetch(`${TELEGRAM_API_BASE}${token}/${method}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    const error = new Error(data.description ?? `Telegram API ${method} failed (${response.status})`);
    error.code = 'telegram_api_error';
    error.telegram = data;
    throw error;
  }

  return data.result;
}

function buildWelcomeReplyMarkup(webAppUrl) {
  return {
    inline_keyboard: [
      [
        {
          text: '🚀 Открыть Workflow',
          web_app: { url: webAppUrl },
        },
      ],
    ],
  };
}

async function sendWelcomeMessage(chatId) {
  const webAppUrl = getWebAppUrl();
  if (!webAppUrl) {
    const error = new Error('WEBAPP_URL is not configured');
    error.code = 'not_configured';
    throw error;
  }

  if (!fs.existsSync(WELCOME_IMAGE_PATH)) {
    const error = new Error('Welcome image not found');
    error.code = 'welcome_image_missing';
    throw error;
  }

  const imageBuffer = fs.readFileSync(WELCOME_IMAGE_PATH);
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('photo', new Blob([imageBuffer], { type: 'image/png' }), 'workflow-welcome.png');
  form.append('caption', WELCOME_CAPTION);
  form.append('reply_markup', JSON.stringify(buildWelcomeReplyMarkup(webAppUrl)));

  return callTelegramApi('sendPhoto', { method: 'POST', body: form });
}

async function sendTextMessage(chatId, text) {
  return callTelegramApi('sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

function isStartCommand(text) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  return trimmed === '/start' || trimmed.startsWith('/start ');
}

function isAppsVerifyCommand(text) {
  if (typeof text !== 'string') return false;
  const command = text.trim().split(/\s/)[0];
  return command === '/appss_verify' || command.startsWith('/appss_verify@');
}

async function handleTelegramUpdate(update) {
  const message = update?.message ?? update?.edited_message;
  if (!message?.chat?.id) {
    return { handled: false, reason: 'no_message' };
  }

  const text = message.text ?? '';

  if (isAppsVerifyCommand(text)) {
    await sendTextMessage(message.chat.id, APPS_VERIFY_RESPONSE);
    return { handled: true, action: 'apps_verify_sent' };
  }

  if (!isStartCommand(text)) {
    return { handled: false, reason: 'unknown_command' };
  }

  await sendWelcomeMessage(message.chat.id);
  return { handled: true, action: 'welcome_sent' };
}

async function setTelegramWebhook(webhookUrl) {
  const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();
  const payload = {
    url: webhookUrl,
    allowed_updates: ['message', 'edited_message'],
    drop_pending_updates: false,
  };

  if (secret) {
    payload.secret_token = secret;
  }

  return callTelegramApi('setWebhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function registerTelegramWebhookOnStartup() {
  if (!isTelegramBotConfigured()) {
    console.log('[telegram] Bot token not configured — webhook skipped');
    return;
  }

  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    console.log('[telegram] Webhook URL not available — set TELEGRAM_WEBHOOK_URL or deploy on Render');
    return;
  }

  try {
    await setTelegramWebhook(webhookUrl);
    console.log(`[telegram] Webhook registered: ${webhookUrl}`);
  } catch (error) {
    console.error('[telegram] Failed to register webhook:', error.message);
  }
}

function verifyWebhookSecret(req) {
  const expected = String(process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();
  if (!expected) return true;
  const received = String(req.header('X-Telegram-Bot-Api-Secret-Token') ?? '').trim();
  return received === expected;
}

module.exports = {
  WELCOME_CAPTION,
  WELCOME_IMAGE_PATH,
  isTelegramBotConfigured,
  isWebAppUrlConfigured,
  isWelcomeReady,
  getWebhookUrl,
  sendWelcomeMessage,
  handleTelegramUpdate,
  setTelegramWebhook,
  registerTelegramWebhookOnStartup,
  verifyWebhookSecret,
};
