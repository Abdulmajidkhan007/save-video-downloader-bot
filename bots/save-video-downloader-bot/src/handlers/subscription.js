'use strict';

const storage = require('../services/storage');
const notify = require('../services/notify');
const { subscriptionKeyboard } = require('../utils/keyboard');

// getChatMember statuslari — obuna hisoblanadigan holatlar.
// "restricted" alohida ko'riladi: faqat is_member===true bo'lsa obuna hisoblanadi.
// "left" va "kicked" — obuna EMAS.
const OK_STATUSES = ['creator', 'administrator', 'member'];

// Kanalni tekshirib bo'lmaganda adminlarga ogohlantirish — kanal bo'yicha
// 24 soatda ko'pi bilan 1 marta yuboriladi (spam bo'lmasin).
const ADMIN_WARN_TTL_MS = 24 * 60 * 60 * 1000;
const lastAdminWarn = new Map(); // channelKey -> timestamp

function warnAdminsThrottled(channelLabel) {
  const now = Date.now();
  const last = lastAdminWarn.get(channelLabel) || 0;
  if (now - last < ADMIN_WARN_TTL_MS) return;
  lastAdminWarn.set(channelLabel, now);
  notify.notifyAdmins(
    `⚠️ <b>${channelLabel}</b> tekshirib bo'lmayapti — ` +
      "bot kanalda admin emasligi mumkin."
  );
}

// member obyektidan obuna holatini aniqlaymiz.
function isSubscribed(member) {
  if (!member || !member.status) return false;
  if (OK_STATUSES.includes(member.status)) return true;
  // restricted bo'lsa ham kanal a'zosi bo'lishi mumkin (is_member)
  if (member.status === 'restricted' && member.is_member === true) return true;
  return false;
}

// Foydalanuvchi barcha majburiy kanallarga obuna bo'lganini tekshiradi.
// MUHIM: getChatMember ga HAR DOIM foydalanuvchi ID si (msg.from.id /
// query.from.id) uzatiladi — hech qachon chat.id emas (guruhda chat.id
// guruh IDsi bo'lib qoladi va tekshiruv buziladi).
async function checkSubscription(bot, userId) {
  const channels = storage.getChannels();
  if (!channels.length) return { ok: true, missing: [] };

  const missing = [];
  for (const ch of channels) {
    const chatRef = ch.username ? `@${String(ch.username).replace(/^@/, '')}` : ch.id;
    try {
      const member = await bot.getChatMember(chatRef, userId);
      const status = member && member.status;
      // Har tekshiruvni log qilamiz — debug uchun kerak.
      console.log(`[subscription] user=${userId} channel=${chatRef} status=${status}`);
      if (!isSubscribed(member)) {
        missing.push(ch);
      }
    } catch (err) {
      // Kanalni tekshirib BO'LMADI (bot admin emas / kanal topilmadi).
      // Bu — "obuna emas" degani EMAS: foydalanuvchini bloklamaymiz, shu
      // kanal tekshiruvini o'tkazib yuboramiz va adminni bir marta ogohlantiramiz.
      console.error(
        `[subscription] user=${userId} channel=${chatRef} XATO: ${err.message} ` +
          '(tekshirib bo\'lmadi — o\'tkazib yuborildi)'
      );
      warnAdminsThrottled(chatRef);
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
