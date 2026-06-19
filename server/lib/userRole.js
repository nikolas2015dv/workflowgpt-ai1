const VALID_ROLES = new Set(['owner', 'pro', 'free']);

function getOwnerTelegramId() {
  const raw = process.env.OWNER_TELEGRAM_ID;
  if (!raw || !String(raw).trim()) return null;
  const parsed = Number(String(raw).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveRole(telegramId, dbRole) {
  const ownerId = getOwnerTelegramId();
  if (ownerId != null && Number(telegramId) === ownerId) {
    return 'owner';
  }
  return VALID_ROLES.has(dbRole) ? dbRole : 'free';
}

function isOwnerUser(user) {
  if (!user || user.role !== 'owner') return false;
  const ownerTelegramId = getOwnerTelegramId();
  if (ownerTelegramId == null) return user.role === 'owner';
  return Number(user.telegram_id) === ownerTelegramId;
}

module.exports = {
  VALID_ROLES,
  getOwnerTelegramId,
  resolveRole,
  isOwnerUser,
};
