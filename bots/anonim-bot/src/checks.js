'use strict';
const { state } = require('./state');

const RATE_PER_MIN = Number(process.env.RATE_PER_MIN) || 5;
const RATE_PER_HOUR = Number(process.env.RATE_PER_HOUR) || 30;

// Rate limit: { ok, retryAfter?, scope? }
function checkRateLimit(userId) {
  const now = Date.now();
  const arr = (state.rateLimits.get(userId) || []).filter((t) => now - t < 3600_000);
  const lastMin = arr.filter((t) => now - t < 60_000).length;
  if (lastMin >= RATE_PER_MIN) return { ok: false, retryAfter: 60, scope: 'minute' };
  if (arr.length >= RATE_PER_HOUR) return { ok: false, retryAfter: 3600, scope: 'hour' };
  arr.push(now);
  state.rateLimits.set(userId, arr);
  return { ok: true };
}

function isBanned(userId) {
  return !!state.bans[String(userId)];
}

function isBlocked(ownerId, senderId) {
  const list = state.blocks[String(ownerId)] || [];
  return list.includes(String(senderId));
}

// Kanal obunasini tekshirish
async function checkChannels(bot, userId) {
  if (!state.channels || state.channels.length === 0) return { ok: true, missing: [] };
  const missing = [];
  for (const ch of state.channels) {
    try {
      const target = ch.username ? `@${ch.username}` : ch.id;
      if (!target) continue;
      const m = await bot.getChatMember(target, userId);
      const status = m && m.status;
      if (!['member', 'administrator', 'creator', 'restricted'].includes(status)) {
        missing.push(ch);
      }
    } catch (e) {
      // tekshira olmasak (masalan bot kanalda admin emas) — bloklamaymiz
      console.error('channel check fail:', ch.title || ch.username || ch.id, e.message);
    }
  }
  return { ok: missing.length === 0, missing };
}

module.exports = { checkRateLimit, isBanned, isBlocked, checkChannels, RATE_PER_MIN, RATE_PER_HOUR };
