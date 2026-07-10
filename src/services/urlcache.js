'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { config } = require('../config');

// callback_data 64 bayt bilan cheklangan, URL esa uzun bo'lishi mumkin.
// Shuning uchun URL'ni qisqa ID bilan JSON faylga saqlaymiz va callback'da
// faqat ID yuboramiz: "mp3:<id>" yoki "song:<id>".
// 24 soatdan eski yozuvlar avtomatik tozalanadi.

function readCache() {
  try {
    if (!fs.existsSync(config.FILES.urlcache)) return {};
    const raw = fs.readFileSync(config.FILES.urlcache, 'utf8');
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error('[urlcache] o\'qishda xato:', err.message);
    return {};
  }
}

function writeCache(cache) {
  try {
    const dir = path.dirname(config.FILES.urlcache);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${config.FILES.urlcache}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache), 'utf8');
    fs.renameSync(tmp, config.FILES.urlcache);
  } catch (err) {
    console.error('[urlcache] yozishda xato:', err.message);
  }
}

// Eski (24h+) yozuvlarni olib tashlaydi.
function prune(cache) {
  const now = Date.now();
  let changed = false;
  for (const [id, entry] of Object.entries(cache)) {
    if (!entry || now - (entry.createdAt || 0) > config.URLCACHE_TTL_MS) {
      delete cache[id];
      changed = true;
    }
  }
  return changed;
}

// URL (va ixtiyoriy meta) saqlab, qisqa ID qaytaradi.
function put(url, meta = {}) {
  const cache = readCache();
  prune(cache);
  const id = crypto.randomBytes(4).toString('hex'); // 8 belgi
  cache[id] = { url, meta, createdAt: Date.now() };
  writeCache(cache);
  return id;
}

// ID bo'yicha yozuvni qaytaradi (yo'q/eskirgan bo'lsa null).
function get(id) {
  const cache = readCache();
  const entry = cache[id];
  if (!entry) return null;
  if (Date.now() - (entry.createdAt || 0) > config.URLCACHE_TTL_MS) {
    delete cache[id];
    writeCache(cache);
    return null;
  }
  return entry;
}

// Vaqti-vaqti bilan tozalash (bot.js dan chaqiriladi).
function cleanup() {
  const cache = readCache();
  if (prune(cache)) writeCache(cache);
}

module.exports = { put, get, cleanup };
