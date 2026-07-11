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

// Ommaviy xabar yuborish.
// mode: 'copy' | 'forward'; target: 'users' | 'groups' | 'all'.
// Foydalanuvchilar: faqat 'private' va bloklanmaganlar.
// Guruhlar: faqat 'left' bo'lmaganlar; xato bersa left=true belgilanadi.
async function runBroadcast(bot, { mode, target = 'users', source, onProgress }) {
  const delayMs = Math.ceil(1000 / config.BROADCAST_RATE_PER_SEC);

  const sendOne = (chatId) =>
    mode === 'forward'
      ? bot.forwardMessage(chatId, source.chatId, source.messageId)
      : bot.copyMessage(chatId, source.chatId, source.messageId);

  const userIds = target === 'users' || target === 'all' ? storage.getPrivateUserIds() : [];
  const groupIds =
    target === 'groups' || target === 'all' ? storage.getBroadcastGroupIds() : [];

  const grandTotal = userIds.length + groupIds.length;
  let done = 0;

  const res = {
    userTotal: userIds.length,
    userSent: 0,
    userBlocked: 0,
    userFailed: 0,
    groupTotal: groupIds.length,
    groupSent: 0,
    groupFailed: 0,
  };

  const bump = async () => {
    done += 1;
    if (onProgress && done % 25 === 0) await onProgress(done, grandTotal);
  };

  // ---- Foydalanuvchilar ----
  for (const uid of userIds) {
    try {
      await sendOne(uid);
      res.userSent += 1;
    } catch (err) {
      const retryAfter =
        err && err.response && err.response.body && err.response.body.parameters
          ? err.response.body.parameters.retry_after
          : null;
      if (retryAfter) {
        await sleep((retryAfter + 1) * 1000);
        try {
          await sendOne(uid);
          res.userSent += 1;
        } catch (err2) {
          if (isBlockedError(err2)) {
            res.userBlocked += 1;
            storage.setUserBlocked(uid, true);
          } else {
            res.userFailed += 1;
          }
        }
      } else if (isBlockedError(err)) {
        res.userBlocked += 1;
        storage.setUserBlocked(uid, true);
      } else {
        res.userFailed += 1;
      }
    }
    await bump();
    await sleep(delayMs);
  }

  // ---- Guruhlar ----
  for (const gid of groupIds) {
    try {
      await sendOne(gid);
      res.groupSent += 1;
    } catch (err) {
      const retryAfter =
        err && err.response && err.response.body && err.response.body.parameters
          ? err.response.body.parameters.retry_after
          : null;
      if (retryAfter) {
        await sleep((retryAfter + 1) * 1000);
        try {
          await sendOne(gid);
          res.groupSent += 1;
        } catch (err2) {
          res.groupFailed += 1;
          storage.markGroupLeft(gid);
        }
      } else {
        // Guruhga yuborib bo'lmadi (bot chiqarilgan/xato) — left=true belgilaymiz.
        res.groupFailed += 1;
        storage.markGroupLeft(gid);
      }
    }
    await bump();
    await sleep(delayMs);
  }

  return res;
}

module.exports = { runBroadcast };
