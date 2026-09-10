'use strict';

const storage = require('./storage');

// A'zo hisoblanadigan holatlar.
const MEMBER_STATUSES = ['creator', 'administrator', 'member'];

// Foydalanuvchi barcha majburiy kanallarga a'zo bo'lganini tekshiradi.
// Qaytaradi: { ok: boolean, missing: [channel] }.
async function checkSubscription(bot, userId) {
  const channels = storage.getChannels();
  if (!channels.length) {
    return { ok: true, missing: [] };
  }

  const missing = [];
  for (const channel of channels) {
    try {
      const member = await bot.getChatMember(channel.id, userId);
      if (!MEMBER_STATUSES.includes(member.status)) {
        missing.push(channel);
      }
    } catch (err) {
      // Bot kanalda admin emas yoki kanal mavjud emas — tekshira olmaymiz.
      // Bunday holatda foydalanuvchini bloklamaymiz, lekin log qoldiramiz.
      console.error(
        `⚠️  ${channel.id} (${channel.title || ''}) tekshirib bo'lmadi:`,
        err.message
      );
    }
  }

  return { ok: missing.length === 0, missing };
}

module.exports = { checkSubscription };
