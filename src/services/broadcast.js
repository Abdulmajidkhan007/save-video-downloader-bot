'use strict';

const storage = require('../services/storage');
const { config } = require('../config');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ommaviy xabar yuborish.
// mode: 'copy' (nusxa) yoki 'forward' (forward).
// source: { chatId, messageId } — asl xabar.
// onProgress(sent, total) — davomiylik uchun callback (opsional).
async function runBroadcast(bot, { mode, source, onProgress }) {
  const userIds = storage.getAllUserIds();
  const total = userIds.length;

  let sent = 0;
  let failed = 0; // bloklagan yoki yetib bo'lmaydigan foydalanuvchilar
  const delayMs = Math.ceil(1000 / config.BROADCAST_RATE_PER_SEC);

  for (let i = 0; i < userIds.length; i += 1) {
    const uid = userIds[i];
    try {
      if (mode === 'forward') {
        await bot.forwardMessage(uid, source.chatId, source.messageId);
      } else {
        await bot.copyMessage(uid, source.chatId, source.messageId);
      }
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
          if (mode === 'forward') {
            await bot.forwardMessage(uid, source.chatId, source.messageId);
          } else {
            await bot.copyMessage(uid, source.chatId, source.messageId);
          }
          sent += 1;
        } catch (_) {
          failed += 1;
        }
      } else {
        // 403 (bot bloklangan) va boshqa xatolar
        failed += 1;
      }
    }

    // Progress har 25 tadan keyin
    if (onProgress && (i + 1) % 25 === 0) {
      await onProgress(sent + failed, total);
    }

    await sleep(delayMs);
  }

  return { total, sent, failed };
}

module.exports = { runBroadcast };
