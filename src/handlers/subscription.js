'use strict';

const storage = require('../services/storage');
const { subscriptionKeyboard } = require('../utils/keyboard');

// getChatMember statuslari — obuna hisoblanadigan holatlar.
const OK_STATUSES = ['creator', 'administrator', 'member'];

// Foydalanuvchi barcha majburiy kanallarga obuna bo'lganini tekshiradi.
// Bot kanalda admin bo'lmasa yoki kanal noto'g'ri bo'lsa — o'sha kanalni
// "o'tgan" deb hisoblaymiz (aks holda hech kim botdan foydalana olmaydi).
async function checkSubscription(bot, userId) {
  const channels = storage.getChannels();
  if (!channels.length) return { ok: true, missing: [] };

  const missing = [];
  for (const ch of channels) {
    const chatId = ch.username ? `@${String(ch.username).replace(/^@/, '')}` : ch.id;
    try {
      const member = await bot.getChatMember(chatId, userId);
      if (!OK_STATUSES.includes(member.status)) {
        missing.push(ch);
      }
    } catch (err) {
      // Bot kanalda admin emas yoki kanal topilmadi — bu kanalni tekshirib
      // bo'lmadi. Foydalanuvchini bloklamaslik uchun "o'tgan" deb qoldiramiz.
      console.error(
        `[subscription] ${chatId} tekshirib bo'lmadi: ${err.message} ` +
          '(bot kanalda admin ekanini tekshiring)'
      );
    }
  }
  return { ok: missing.length === 0, missing };
}

// Obuna bo'lmagan foydalanuvchiga kanallar ro'yxatini yuboradi.
// opts: { userId, replyToMessageId, short } — guruh uchun qisqa reply variant.
async function sendSubscriptionPrompt(bot, chatId, channels, opts = {}) {
  const text = opts.short
    ? '📢 Avval kanalimizga obuna bo\'ling, so\'ng «✅ Tekshirish» tugmasini bosing.'
    : '📢 Botdan foydalanish uchun quyidagi kanal(lar)ga obuna bo\'ling:\n\n' +
      'Obuna bo\'lgach «✅ Obunani tekshirish» tugmasini bosing.';
  const sendOpts = {
    reply_markup: subscriptionKeyboard(channels, opts.userId),
  };
  if (opts.replyToMessageId) {
    sendOpts.reply_to_message_id = opts.replyToMessageId;
    sendOpts.allow_sending_without_reply = true;
  }
  await bot.sendMessage(chatId, text, sendOpts);
}

module.exports = { checkSubscription, sendSubscriptionPrompt };
