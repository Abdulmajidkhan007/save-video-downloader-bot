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

const config = {
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  ADMIN_IDS: parseAdminIds(process.env.ADMIN_IDS),
  DATA_DIR,
  DOWNLOADS_DIR,
  // Opsional cookies.txt yo'li (YouTube "bot emasligini tasdiqlang" xatosi uchun)
  YTDLP_COOKIES: process.env.YTDLP_COOKIES || '',
  // yt-dlp binary yo'li — Railwayda standalone binary ./bin/yt-dlp ga yuklanadi
  YTDLP_PATH: process.env.YTDLP_PATH || './bin/yt-dlp',

  // Telegram Bot API orqali fayl yuborish limiti (50 MB)
  MAX_FILE_SIZE_MB: 50,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,

  // Broadcast rate-limit: soniyasiga ~25 xabar
  BROADCAST_RATE_PER_SEC: 25,

  // Fayl yo'llari
  FILES: {
    users: path.join(DATA_DIR, 'users.json'),
    channels: path.join(DATA_DIR, 'channels.json'),
    stats: path.join(DATA_DIR, 'stats.json'),
  },
};

function isAdmin(userId) {
  return config.ADMIN_IDS.includes(String(userId));
}

module.exports = { config, isAdmin };
