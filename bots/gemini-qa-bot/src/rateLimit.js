'use strict';

const config = require('./config');

// chatId -> [timestamp, timestamp, ...]
const hits = new Map();

/**
 * Foydalanuvchi so'rov yubora oladimi, tekshiradi.
 * @returns {{ allowed: boolean, retryAfterSec: number }}
 */
function check(chatId, now = Date.now()) {
  const windowMs = config.rateLimitWindowMs;
  const max = config.rateLimitMax;

  const arr = (hits.get(chatId) || []).filter((t) => now - t < windowMs);

  if (arr.length >= max) {
    const oldest = arr[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    hits.set(chatId, arr);
    return { allowed: false, retryAfterSec };
  }

  arr.push(now);
  hits.set(chatId, arr);
  return { allowed: true, retryAfterSec: 0 };
}

module.exports = { check, _hits: hits };
