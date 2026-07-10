'use strict';

// .env faylni yuklaymiz (lokal ishlash uchun). Railwayda env dashboard orqali beriladi.
require('dotenv').config();

const path = require('path');

function parseAdminIds(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => String(s));
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');

const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR
  ? path.resolve(process.env.DOWNLOADS_DIR)
  : path.resolve(process.cwd(), 'downloads');

// Cookies fayli DATA_DIR ichida saqlanadi. YTDLP_COOKIES env orqali qo'lda
// yo'l berilsa — o'sha ustun turadi, aks holda DATA_DIR/cookies.txt.
const COOKIES_PATH = process.env.YTDLP_COOKIES
  ? path.resolve(process.env.YTDLP_COOKIES)
  : path.join(DATA_DIR, 'cookies.txt');

const config = {
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  ADMIN_IDS: parseAdminIds(process.env.ADMIN_IDS),
  DATA_DIR,
  DOWNLOADS_DIR,
  // cookies.txt yo'li (YouTube "bot emasligini tasdiqlang" xatosi uchun)
  YTDLP_COOKIES: COOKIES_PATH,
  // cookies.txt ning base64 ko'rinishi (Railway Variables bir qatorli bo'lgani uchun)
  YTDLP_COOKIES_B64: process.env.YTDLP_COOKIES_B64 || '',
  // yt-dlp binary yo'li — Railwayda standalone binary bin/yt-dlp ga yuklanadi.
  // Fallback absolyut yo'l bo'lsin: ish papkasi (cwd) o'zgarsa ham topilaveradi.
  YTDLP_PATH: process.env.YTDLP_PATH || path.join(__dirname, '..', 'bin', 'yt-dlp'),
  // gallery-dl binary yo'li (rasm yuklash uchun)
  GALLERY_DL_PATH:
    process.env.GALLERY_DL_PATH || path.join(__dirname, '..', 'bin', 'gallery-dl'),
  // ffmpeg binary (musiqa aniqlash uchun audio kesishda ishlatiladi)
  FFMPEG_PATH: process.env.FFMPEG_PATH || 'ffmpeg',

  // ACRCloud (Shazam kabi musiqa aniqlash). Bo'sh bo'lsa funksiya o'chiq.
  ACR_HOST: process.env.ACR_HOST || '',
  ACR_ACCESS_KEY: process.env.ACR_ACCESS_KEY || '',
  ACR_ACCESS_SECRET: process.env.ACR_ACCESS_SECRET || '',

  // Telegram Bot API orqali fayl yuborish limiti (50 MB)
  MAX_FILE_SIZE_MB: 50,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,

  // Broadcast rate-limit: soniyasiga ~25 xabar
  BROADCAST_RATE_PER_SEC: 25,

  // urlcache TTL (24 soat) — mp3/song callback'lari uchun
  URLCACHE_TTL_MS: 24 * 60 * 60 * 1000,

  // Fayl yo'llari
  FILES: {
    users: path.join(DATA_DIR, 'users.json'),
    channels: path.join(DATA_DIR, 'channels.json'),
    stats: path.join(DATA_DIR, 'stats.json'),
    groups: path.join(DATA_DIR, 'groups.json'),
    urlcache: path.join(DATA_DIR, 'urlcache.json'),
  },
};

function acrEnabled() {
  return Boolean(config.ACR_HOST && config.ACR_ACCESS_KEY && config.ACR_ACCESS_SECRET);
}

function isAdmin(userId) {
  return config.ADMIN_IDS.includes(String(userId));
}

module.exports = { config, isAdmin, acrEnabled };
