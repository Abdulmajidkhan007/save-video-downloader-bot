'use strict';

// .env faylni yuklaymiz (lokal ishlash uchun). Railwayda env dashboard orqali beriladi.
require('dotenv').config();

const path = require('path');
const fs = require('fs');

// Binary yo'lini aniqlaydi: env > bundlangan (bin/) > tizimdagi (PATH).
// Shunда Railway'da bin/ ishlatiladi, uy qurilmasida (Termux/Kali) tizimdagi
// yt-dlp/ffmpeg/gallery-dl avtomatik topiladi — qo'shimcha sozlashsiz.
function resolveBinary(envVal, bundledPath, systemName) {
  if (envVal) return envVal;
  try {
    if (fs.existsSync(bundledPath)) return bundledPath;
  } catch (_) {
    /* ignore */
  }
  return systemName;
}

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

// Cookies fayli DOIM DATA_DIR/cookies.txt. Faqat YTDLP_COOKIES_B64 env'idan
// dekod qilinib shu faylga yoziladi (chalkashlik bo'lmasligi uchun bitta manba).
const COOKIES_PATH = path.join(DATA_DIR, 'cookies.txt');

// Boshlang'ich majburiy obuna kanallari (vergul bilan: @kanal1,@kanal2).
// Faqat channels.json bo'sh/yo'q bo'lsa seed qilinadi.
function parseInitialChannels(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^@/, ''));
}

// Avto-tarqatish uchun manba kanallar (id yoki @username, vergul bilan).
// Har birini id (raqamli) yoki username (kichik harf, @'siz) sifatida normallashtiramiz.
function parseSourceChannels(raw) {
  const ids = new Set();
  const usernames = new Set();
  if (!raw) return { ids, usernames, list: [] };
  const list = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const entry of list) {
    if (/^-?\d+$/.test(entry)) {
      ids.add(entry);
    } else {
      usernames.add(entry.replace(/^@/, '').toLowerCase());
    }
  }
  return { ids, usernames, list };
}

// Local Bot API bo'lsa limit avtomatik 2000MB, aks holda 50MB.
// MAX_FILE_SIZE_MB env berilsa — o'sha ustun turadi.
const TELEGRAM_API_URL = process.env.TELEGRAM_API_URL || '';
const MAX_FILE_SIZE_MB =
  Number(process.env.MAX_FILE_SIZE_MB) > 0
    ? Number(process.env.MAX_FILE_SIZE_MB)
    : TELEGRAM_API_URL
      ? 2000
      : 50;

const config = {
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  ADMIN_IDS: parseAdminIds(process.env.ADMIN_IDS),
  INITIAL_CHANNELS: parseInitialChannels(process.env.INITIAL_CHANNELS),
  // Avto-tarqatish manba kanallari
  SOURCE_CHANNELS: parseSourceChannels(process.env.SOURCE_CHANNELS),
  // Tarqatish usuli: 'copy' (default, toza) yoki 'forward' ("kanaldan" belgisi bilan)
  FORWARD_MODE: process.env.FORWARD_MODE === 'forward' ? 'forward' : 'copy',
  DATA_DIR,
  DOWNLOADS_DIR,
  // cookies.txt yo'li (DOIM DATA_DIR/cookies.txt — YTDLP_COOKIES_B64 dan yoziladi)
  YTDLP_COOKIES: COOKIES_PATH,
  // cookies.txt ning base64 ko'rinishi (Railway Variables bir qatorli bo'lgani uchun)
  YTDLP_COOKIES_B64: process.env.YTDLP_COOKIES_B64 || '',
  // yt-dlp binary — env > bin/yt-dlp (Railway) > tizimdagi "yt-dlp" (uy qurilmasi).
  YTDLP_PATH: resolveBinary(
    process.env.YTDLP_PATH,
    path.join(__dirname, '..', 'bin', 'yt-dlp'),
    'yt-dlp'
  ),
  // YouTube extractor player_client — datacenter IP'da "format not available"
  // muammosini ko'p hollarda hal qiladi. Vergul bilan bir nechta berish mumkin.
  // Bo'sh qilib butunlay o'chirish uchun YTDLP_PLAYER_CLIENT=off qo'ying.
  YTDLP_PLAYER_CLIENT:
    process.env.YTDLP_PLAYER_CLIENT === undefined
      ? 'default,web_safari,tv,android,ios'
      : process.env.YTDLP_PLAYER_CLIENT,
  // Proxy — datacenter IP bloklovi uchun (masalan: http://user:pass@host:port).
  // YouTube Railway/AWS IP'larini bloklaydi; residential proxy buni hal qiladi.
  YTDLP_PROXY: process.env.YTDLP_PROXY || '',
  // Qo'shimcha yt-dlp argumentlari (bo'sh joy bilan). Masalan PO token:
  // --extractor-args "youtube:po_token=web+XXXX"
  YTDLP_EXTRA_ARGS: process.env.YTDLP_EXTRA_ARGS || '',
  // gallery-dl binary — env > bin/ (Railway) > tizimdagi "gallery-dl" (uy qurilmasi)
  GALLERY_DL_PATH: resolveBinary(
    process.env.GALLERY_DL_PATH,
    path.join(__dirname, '..', 'bin', 'gallery-dl'),
    'gallery-dl'
  ),
  // ffmpeg binary — env > bin/ffmpeg (Railway) > tizimdagi "ffmpeg" (uy qurilmasi)
  FFMPEG_PATH: resolveBinary(
    process.env.FFMPEG_PATH,
    path.join(__dirname, '..', 'bin', 'ffmpeg'),
    'ffmpeg'
  ),

  // ACRCloud (Shazam kabi musiqa aniqlash). Bo'sh bo'lsa funksiya o'chiq.
  ACR_HOST: process.env.ACR_HOST || '',
  ACR_ACCESS_KEY: process.env.ACR_ACCESS_KEY || '',
  ACR_ACCESS_SECRET: process.env.ACR_ACCESS_SECRET || '',

  // Local Bot API Server manzili (baseApiUrl). Bo'sh bo'lsa — rasmiy
  // api.telegram.org (50MB limit). Local server bilan 2GB gacha yuborish mumkin.
  TELEGRAM_API_URL,
  // Fayl yuborish limiti (MB). Avtomatik: Local API bo'lsa 2000, aks holda 50.
  // MAX_FILE_SIZE_MB env berilsa — o'sha ustun turadi.
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES: MAX_FILE_SIZE_MB * 1024 * 1024,
  // Katta videoni avtomatik sifat pasaytirish (720→480→360). Local API bilan
  // 2GB limit bo'lgani uchun odatda kerak emas — o'chirish: AUTO_DOWNSCALE=off.
  AUTO_DOWNSCALE: process.env.AUTO_DOWNSCALE !== 'off',

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
    adminLog: path.join(DATA_DIR, 'admin_log.json'),
    settings: path.join(DATA_DIR, 'settings.json'),
    sentPosts: path.join(DATA_DIR, 'sent_posts.json'),
    contactMap: path.join(DATA_DIR, 'contact_map.json'),
  },
};

function acrEnabled() {
  return Boolean(config.ACR_HOST && config.ACR_ACCESS_KEY && config.ACR_ACCESS_SECRET);
}

// channel_post kelgan chat manba kanallardan biriga tegishlimi?
function isSourceChannel(chat) {
  if (!chat) return false;
  const src = config.SOURCE_CHANNELS;
  if (src.ids.has(String(chat.id))) return true;
  if (chat.username && src.usernames.has(String(chat.username).toLowerCase())) return true;
  return false;
}

function isAdmin(userId) {
  return config.ADMIN_IDS.includes(String(userId));
}

module.exports = { config, isAdmin, acrEnabled, isSourceChannel };
