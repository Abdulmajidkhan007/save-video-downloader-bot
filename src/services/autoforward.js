'use strict';

const { config, isSourceChannel } = require('../config');
const storage = require('./storage');
const notify = require('./notify');
const { runBroadcast } = require('./broadcast');

// Manba kanaldan kelgan postni barcha private userlar va faol guruhlarga tarqatadi.
// Broadcast bilan bir xil xavfsizlik: rate limit, 429 retry_after, bloklagan
// user blocked=true, chiqarilgan guruh left=true — runBroadcast ichida.
async function handleChannelPost(bot, msg) {
  if (!msg || !msg.chat) return;
  // Faqat manba kanallardan kelgan postlar
  if (!isSourceChannel(msg.chat)) return;

  // Toggle o'chiq bo'lsa — tarqatmaymiz
  const settings = storage.getSettings();
  if (!settings.autoForward) {
    console.log('[autoforward] o\'chiq — post tarqatilmadi');
    return;
  }

  // Anti-dublikat: shu post allaqachon tarqatilgan bo'lsa — chiqamiz.
  const key = `${msg.chat.id}:${msg.message_id}`;
  if (storage.isPostSent(key)) {
    console.log(`[autoforward] dublikat o'tkazildi: ${key}`);
    return;
  }
  // Yuborishdan OLDIN belgilaymiz — qayta ishga tushsa ikki marta ketmasin.
  storage.markPostSent(key);

  console.log(`[autoforward] post tarqatilmoqda: ${key} (mode=${config.FORWARD_MODE})`);

  const result = await runBroadcast(bot, {
    mode: config.FORWARD_MODE,
    target: 'all',
    source: { chatId: msg.chat.id, messageId: msg.message_id },
  });

  await notify.notifyAdmins(
    '📢 <b>Yangi post tarqatildi</b>\n' +
      `👤 Userlar: ${result.userSent}/${result.userTotal}\n` +
      `👥 Guruhlar: ${result.groupSent}/${result.groupTotal}` +
      (result.userBlocked ? `\n🚫 Bloklagan: ${result.userBlocked}` : '') +
      (result.groupFailed ? `\n🚪 Guruhdan chiqarilgan: ${result.groupFailed}` : '')
  );
}

module.exports = { handleChannelPost };
