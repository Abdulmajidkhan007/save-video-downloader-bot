'use strict';

const storage = require('../services/storage');
const { config } = require('../config');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Xato "bot bloklangan / user o'chirilgan" turidami — aniqlaymiz.
function isBlockedError(err) {
  const code =
    err && err.response && err.response.body ? err.response.body.error_code : null;
  const desc =
    err && err.response && err.response.body
      ? String(err.response.body.description || '').toLowerCase()
      : String((err && err.message) || '').toLowerCase();
  return (
    code === 403 ||
    desc.includes('blocked') ||
    desc.includes('user is deactivated') ||
    desc.includes('bot was kicked') ||
    desc.includes('chat not found')
  );
}

// Ommaviy xabar yuborish — FAQAT 'private' va bloklanmagan foydalanuvchilarga.
// mode: 'copy' (nusxa) yoki 'forward' (forward).
// source: { chatId, messageId } — asl xabar.
// onProgress(done, total) — davomiylik uchun callback (opsional).
async function runBroadcast(bot, { mode, source, onProgress }) {
  const userIds = storage.getPrivateUserIds();
  const total = userIds.length;

  let sent = 0;
  let blocked = 0; // bot bloklangan/yetib bo'lmaydigan foydalanuvchilar
  let failed = 0; // boshqa xatolar
  const delayMs = Math.ceil(1000 / config.BROADCAST_RATE_PER_SEC);

  const sendOne = (uid) =>
    mode === 'forward'
      ? bot.forwardMessage(uid, source.chatId, source.messageId)
      : bot.copyMessage(uid, source.chatId, source.messageId);

  for (let i = 0; i < userIds.length; i += 1) {
    const uid = userIds[i];
    try {
      await sendOne(uid);
      sent += 1;
    } catch (err) {
      // 429 — rate limit: retry_after kutib qayta urinamiz
      const retryAfter =
        err && err.response && err.response.body && err.response.body.parameters
          ? err.response.body.parameters.retry_after
          : null;
      if (retryAfter) {
        await sleep((retryAfter + 1) * 1000);
        try {
          await sendOne(uid);
          sent += 1;
        } catch (err2) {
          if (isBlockedError(err2)) {
            blocked += 1;
            storage.setUserBlocked(uid, true);
          } else {
            failed += 1;
          }
        }
      } else if (isBlockedError(err)) {
        // Bot bloklangan — belgilaymiz, keyingi broadcastlarda o'tkazib yuboramiz
        blocked += 1;
        storage.setUserBlocked(uid, true);
      } else {
        failed += 1;
      }
    }

    if (onProgress && (i + 1) % 25 === 0) {
      await onProgress(sent + blocked + failed, total);
    }

    await sleep(delayMs);
  }

  return { total, sent, blocked, failed };
}

module.exports = { runBroadcast };
