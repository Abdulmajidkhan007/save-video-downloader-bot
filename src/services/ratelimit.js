'use strict';

// Xotiradagi rate limiting va anti-flood (restartda tozalanadi — bu maqbul).

const WINDOW_MS = 60 * 1000; // 1 daqiqa
const MAX_PER_WINDOW = 5; // daqiqasiga max 5 yuklash so'rovi
const DUP_MS = 30 * 1000; // bir xil URL 30s ichida qayta kelsa — ignore
const DAY_MS = 24 * 60 * 60 * 1000;

const reqTimes = new Map(); // uid -> [timestamp]
const lastUrl = new Map(); // uid -> { url, ts }
const limitHits = new Map(); // uid -> { count, lastHit, firstName, username }

// Yuklash so'rovi limitdan oshmaganini tekshiradi. true — ruxsat.
function checkRate(user) {
  const uid = String(user.id);
  const now = Date.now();
  const arr = (reqTimes.get(uid) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) {
    reqTimes.set(uid, arr);
    recordLimitHit(user);
    return false;
  }
  arr.push(now);
  reqTimes.set(uid, arr);
  return true;
}

// Bir xil URL 30s ichida qayta kelganini tekshiradi. true — dublikat (ignore).
function isDuplicate(user, url) {
  const uid = String(user.id);
  const now = Date.now();
  const last = lastUrl.get(uid);
  if (last && last.url === url && now - last.ts < DUP_MS) {
    return true;
  }
  lastUrl.set(uid, { url, ts: now });
  return false;
}

function recordLimitHit(user) {
  const uid = String(user.id);
  const now = Date.now();
  const e = limitHits.get(uid) || { count: 0, firstName: '', username: '' };
  e.count += 1;
  e.lastHit = now;
  e.firstName = user.first_name || e.firstName;
  e.username = user.username || e.username;
  limitHits.set(uid, e);
}

// So'nggi 24 soatda limitga urilgan foydalanuvchilar.
function getRecentLimitHits() {
  const now = Date.now();
  const out = [];
  for (const [uid, e] of limitHits.entries()) {
    if (now - e.lastHit < DAY_MS) out.push({ id: uid, ...e });
    else limitHits.delete(uid);
  }
  return out.sort((a, b) => b.lastHit - a.lastHit);
}

module.exports = {
  checkRate,
  isDuplicate,
  getRecentLimitHits,
  MAX_PER_WINDOW,
};
