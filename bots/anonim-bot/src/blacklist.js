'use strict';
// Anti-scam tizimi: lokal global_blacklist + tashqi ochiq anti-spam API'lar
//
// Tashqi manbalar (ikkalasi bepul, kalitsiz):
//   • CAS  — Combot Anti-Spam        https://api.cas.chat/check?user_id=<id>
//   • LOLS — Telegram anti-spam bazasi  https://api.lols.bot/account?id=<id>
//
// Tashqi API ishlamasa tizim "fail-open" ishlaydi: xato blokirovka qilmaydi,
// faqat lokal ro'yxat natijasi ko'rsatiladi.

const { state, persist } = require('./state');

const API_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 10 * 60 * 1000; // tashqi natijani 10 daqiqa keshlaymiz

// userId -> { at, result } (faqat xotirada)
const _cache = new Map();

// ── Lokal global_blacklist ──────────────────────────────────

function isLocal(userId) {
  return !!state.blacklist[String(userId)];
}

function addLocal(userId, byAdminId, reason) {
  const id = String(userId);
  if (state.blacklist[id]) return false;
  state.blacklist[id] = {
    at: new Date().toISOString(),
    by: String(byAdminId),
    reason: reason || 'admin qarori',
  };
  persist.blacklist();
  return true;
}

function removeLocal(userId) {
  const id = String(userId);
  if (!state.blacklist[id]) return false;
  delete state.blacklist[id];
  persist.blacklist();
  return true;
}

// ── Tashqi API tekshiruvlari ────────────────────────────────

async function _fetchJson(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// CAS: banlangan bo'lsa {ok:true, result:{offenses,...}}, aks holda {ok:false}
async function _checkCAS(userId) {
  const d = await _fetchJson(`https://api.cas.chat/check?user_id=${encodeURIComponent(userId)}`);
  if (d && d.ok === true) {
    const off = d.result && d.result.offenses;
    return { flagged: true, detail: off ? `${off} ta qoidabuzarlik` : null };
  }
  return { flagged: false };
}

// LOLS: {banned:true/false, ...}
async function _checkLOLS(userId) {
  const d = await _fetchJson(`https://api.lols.bot/account?id=${encodeURIComponent(userId)}`);
  if (d && d.banned === true) {
    return { flagged: true, detail: d.scammer ? 'scammer belgisi' : null };
  }
  return { flagged: false };
}

// Ikkala API'ni parallel so'raymiz; xato = "aniqlanmadi", bloklamaydi
async function checkExternal(userId) {
  const id = String(userId);
  const cached = _cache.get(id);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result;

  const [cas, lols] = await Promise.allSettled([_checkCAS(id), _checkLOLS(id)]);
  const sources = [];
  let unavailable = 0;

  if (cas.status === 'fulfilled') {
    if (cas.value.flagged) sources.push({ name: 'CAS', detail: cas.value.detail });
  } else unavailable++;
  if (lols.status === 'fulfilled') {
    if (lols.value.flagged) sources.push({ name: 'LOLS', detail: lols.value.detail });
  } else unavailable++;

  const result = { flagged: sources.length > 0, sources, unavailable };
  _cache.set(id, { at: Date.now(), result });
  // kesh cheksiz o'smasin
  if (_cache.size > 2000) {
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
  return result;
}

// ── Birlashgan tekshiruv ────────────────────────────────────
// Qaytaradi: { flagged, sources:[{name,detail}], unavailable }
async function checkUser(userId) {
  const id = String(userId);
  const sources = [];
  if (isLocal(id)) {
    const e = state.blacklist[id];
    sources.push({ name: 'Lokal blacklist', detail: e.reason || null });
  }
  let unavailable = 0;
  try {
    const ext = await checkExternal(id);
    sources.push(...ext.sources);
    unavailable = ext.unavailable;
  } catch (e) {
    unavailable = 2;
  }
  return { flagged: sources.length > 0, sources, unavailable };
}

// Status satri (admin kartochkasi uchun)
function statusLine(check) {
  if (check.flagged) {
    const src = check.sources.map(s => s.detail ? `${s.name}: ${s.detail}` : s.name).join(', ');
    return `🚨 *SKAMMER / SPAMMER*\n⚠️ Manba: ${src}`;
  }
  if (check.unavailable >= 2) return '❓ Tekshirib bo\'lmadi (API mavjud emas)';
  return '🟢 Qora ro\'yxatlarda topilmadi';
}

module.exports = { isLocal, addLocal, removeLocal, checkExternal, checkUser, statusLine };
