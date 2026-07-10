'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { config } = require('../config');

// yt-dlp ni execFile orqali chaqiramiz (exec EMAS) — shell injection oldini olish uchun.
// URL har doim alohida argument sifatida uzatiladi, string ichiga qo'shilmaydi.

const MAX_BYTES = config.MAX_FILE_SIZE_BYTES;
const MAX_MB = config.MAX_FILE_SIZE_MB;

// YouTube "bot emasligini tasdiqlang" xatosi belgilari.
const BOT_CHECK_MARKERS = [
  'Sign in to confirm',
  'confirm you’re not a bot',
  "confirm you're not a bot",
  'not a bot',
];

class BotCheckError extends Error {
  constructor() {
    super('YOUTUBE_BOT_CHECK');
    this.name = 'BotCheckError';
    this.code = 'BOT_CHECK';
  }
}

class TooLargeError extends Error {
  constructor(sizeMb) {
    super('FILE_TOO_LARGE');
    this.name = 'TooLargeError';
    this.code = 'TOO_LARGE';
    this.sizeMb = sizeMb;
  }
}

// yt-dlp uchun umumiy argumentlar (cookies opsional).
function commonArgs() {
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
    '--restrict-filenames',
  ];
  if (config.YTDLP_COOKIES && fs.existsSync(config.YTDLP_COOKIES)) {
    args.push('--cookies', config.YTDLP_COOKIES);
  }
  return args;
}

// execFile ni Promise ga o'raymiz.
function runYtDlp(args, { timeout = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      config.YTDLP_PATH,
      args,
      { timeout, maxBuffer: 1024 * 1024 * 20 },
      (err, stdout, stderr) => {
        const out = (stdout || '').toString();
        const errOut = (stderr || '').toString();
        if (err) {
          err.stdout = out;
          err.stderr = errOut;
          return reject(err);
        }
        resolve({ stdout: out, stderr: errOut });
      }
    );
  });
}

// Xato matnida YouTube bot-tekshiruvi bor-yo'qligini aniqlaymiz.
function isBotCheck(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  return BOT_CHECK_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}

// Har bir yuklash uchun noyob token — fayllarni ajratish uchun.
function makeToken() {
  return crypto.randomBytes(8).toString('hex');
}

// Berilgan token bilan boshlangan barcha fayllarni topamiz
// (yt-dlp kengaytmani o'zi tanlaydi: .mp4, .webm, .mp3 ...).
function findOutputFile(dir, token) {
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(token));
  if (files.length === 0) return null;
  // Eng katta faylni tanlaymiz (qism-fayllar bo'lsa ham).
  let best = null;
  let bestSize = -1;
  for (const f of files) {
    const full = path.join(dir, f);
    try {
      const st = fs.statSync(full);
      if (st.isFile() && st.size > bestSize) {
        bestSize = st.size;
        best = full;
      }
    } catch (_) {
      /* ignore */
    }
  }
  return best;
}

// Belgilangan token bilan bog'liq vaqtinchalik fayllarni tozalash.
function cleanupToken(dir, token) {
  try {
    const files = fs.readdirSync(dir).filter((f) => f.startsWith(token));
    for (const f of files) {
      try {
        fs.unlinkSync(path.join(dir, f));
      } catch (_) {
        /* ignore */
      }
    }
  } catch (_) {
    /* ignore */
  }
}

// Format selektorlari — 50MB limitni yt-dlp darajasida qo'llaymiz.
function videoFormatFor(quality) {
  // quality: '360' | '720' | 'best'
  const sizeCap = `[filesize<${MAX_MB}M]`;
  if (quality === '360') {
    return `best[height<=360]${sizeCap}/best[height<=360]/best${sizeCap}/best`;
  }
  if (quality === '720') {
    return `best[height<=720]${sizeCap}/best[height<=720]/best${sizeCap}/best`;
  }
  // boshqa platformalar: eng yaxshi, lekin imkon qadar 50MB ichida
  return `best${sizeCap}/best[ext=mp4]/best`;
}

/**
 * Videoni yuklaydi.
 * @param {string} url
 * @param {object} opts { quality: '360'|'720'|'best', audioOnly: boolean }
 * @returns {Promise<{ filePath, size, token }>}
 */
async function downloadVideo(url, opts = {}) {
  const token = makeToken();
  const dir = config.DOWNLOADS_DIR;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const outputTemplate = path.join(dir, `${token}.%(ext)s`);
  const args = [...commonArgs(), '-o', outputTemplate];

  if (opts.audioOnly) {
    // MP3: faqat audio + ffmpeg orqali konvertatsiya
    args.push(
      '-f',
      'bestaudio/best',
      '--extract-audio',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '0'
    );
  } else {
    args.push('-f', videoFormatFor(opts.quality || 'best'), '--merge-output-format', 'mp4');
  }

  // URL — oxirgi, alohida argument.
  args.push(url);

  try {
    await runYtDlp(args);
  } catch (err) {
    const combined = `${err.stderr || ''}\n${err.stdout || ''}\n${err.message || ''}`;
    cleanupToken(dir, token);
    if (isBotCheck(combined)) {
      throw new BotCheckError();
    }
    throw err;
  }

  const filePath = findOutputFile(dir, token);
  if (!filePath) {
    throw new Error('YUKLANGAN_FAYL_TOPILMADI');
  }

  const size = fs.statSync(filePath).size;
  if (size > MAX_BYTES) {
    cleanupToken(dir, token);
    throw new TooLargeError(Math.round((size / (1024 * 1024)) * 10) / 10);
  }

  return { filePath, size, token };
}

// Yuklangan faylni (va token bilan bog'liq qoldiqlarni) o'chirish.
function removeFile(filePath, token) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {
    /* ignore */
  }
  if (token) cleanupToken(config.DOWNLOADS_DIR, token);
}

// Bot ishga tushganda downloads/ papkasini tozalash.
function cleanDownloadsDir() {
  const dir = config.DOWNLOADS_DIR;
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      return;
    }
    for (const f of fs.readdirSync(dir)) {
      try {
        const full = path.join(dir, f);
        if (fs.statSync(full).isFile()) fs.unlinkSync(full);
      } catch (_) {
        /* ignore */
      }
    }
  } catch (err) {
    console.error('[downloader] downloads tozalashda xato:', err.message);
  }
}

module.exports = {
  downloadVideo,
  removeFile,
  cleanDownloadsDir,
  makeToken,
  BotCheckError,
  TooLargeError,
  MAX_MB,
};
