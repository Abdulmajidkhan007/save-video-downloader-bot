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

// yt-dlp URL'da video topa olmaganda (rasm bo'lishi mumkin) — gallery-dl'ga o'tamiz.
class NoVideoError extends Error {
  constructor() {
    super('NO_VIDEO');
    this.name = 'NoVideoError';
    this.code = 'NO_VIDEO';
  }
}

// "Bu yerda video yo'q" (rasm posti) turidagi xato belgilari — gallery-dl'ga o'tiladi.
// DIQQAT: "requested format is not available" bu YERGA KIRMAYDI — u format
// tanlash muammosi (ayniqsa YouTube), rasm posti emas; uni rasm sifatida
// urinib ko'rish faqat foydalanuvchiga chalkash xato beradi.
const NO_VIDEO_MARKERS = [
  'no video',
  'there is no video',
  'unsupported url',
  'no media found',
  'no video formats found',
];

function isNoVideo(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  return NO_VIDEO_MARKERS.some((m) => lower.includes(m));
}

// cookies.txt mavjudligini bildiradi.
function hasCookies() {
  return Boolean(config.YTDLP_COOKIES && fs.existsSync(config.YTDLP_COOKIES));
}

// yt-dlp uchun umumiy argumentlar (cookies opsional).
function commonArgs() {
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
    '--restrict-filenames',
  ];
  // ffmpeg'ni aniq ko'rsatamiz — konvertatsiya/merge bin/ffmpeg orqali ishlaydi
  // (nixpacks runtime PATH'ida ffmpeg bo'lmasligi mumkin).
  if (config.FFMPEG_PATH) {
    args.push('--ffmpeg-location', config.FFMPEG_PATH);
  }
  // YouTube player_client — "Requested format is not available" muammosini
  // datacenter IP'da yumshatadi ("off" bo'lsa qo'shilmaydi).
  if (config.YTDLP_PLAYER_CLIENT && config.YTDLP_PLAYER_CLIENT.toLowerCase() !== 'off') {
    args.push('--extractor-args', `youtube:player_client=${config.YTDLP_PLAYER_CLIENT}`);
  }
  // Proxy — datacenter IP bloklovi uchun eng ishonchli yechim.
  if (config.YTDLP_PROXY) {
    args.push('--proxy', config.YTDLP_PROXY);
  }
  if (config.YTDLP_COOKIES && fs.existsSync(config.YTDLP_COOKIES)) {
    args.push('--cookies', config.YTDLP_COOKIES);
  }
  // Qo'shimcha argumentlar (PO token va h.k.) — bo'sh joy/qo'shtirnoqni hisobga olib.
  if (config.YTDLP_EXTRA_ARGS) {
    for (const a of tokenizeArgs(config.YTDLP_EXTRA_ARGS)) args.push(a);
  }
  return args;
}

// "a b \"c d\"" -> ['a','b','c d'] — oddiy shell-uslub tokenizer.
function tokenizeArgs(str) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    out.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
  }
  return out;
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

function isFormatError(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  return (
    lower.includes('requested format is not available') || lower.includes('no such format')
  );
}

// Diagnostika: "format not available" bo'lganda YouTube AYNAN qanday formatlar
// berayotganini logga chiqaramiz. Bo'sh bo'lsa — PO-token/cookies muammosi;
// to'la bo'lsa — bizning selektor muammosi.
async function dumpFormats(url) {
  try {
    const { stdout, stderr } = await runYtDlp([...commonArgs(), '-F', url], { timeout: 60000 });
    const out = (stdout || stderr || '').trim();
    const lines = out.split('\n').slice(0, 20).join('\n');
    console.error(`[dumpFormats] ${url}\n${lines || '(formatlar ro\'yxati bo\'sh — YouTube format bermadi)'}`);
  } catch (err) {
    console.error(`[dumpFormats] ${url} — -F ham xato: ${err.stderr || err.message}`);
  }
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

// Format selektorlari.
// MUHIM: YouTube ko'p videolarda BIRLASHGAN (audio+video bitta faylda) format
// bermaydi — faqat alohida oqimlar. Shuning uchun `best` (bitta fayl) ko'pincha
// "Requested format is not available" beradi. Yechim: bestvideo+bestaudio ni
// ffmpeg bilan birlashtiramiz (`bv*+ba/b`). Fayl hajmi yuklab bo'lingach
// tekshiriladi (MAX_BYTES) — shuning uchun bu yerda filesize filtri kerak emas
// (u ham "format not available" sababi bo'lishi mumkin).
function videoFormatFor(quality) {
  if (quality === '360') {
    return 'bv*[height<=360]+ba/b[height<=360]/bv*+ba/b';
  }
  if (quality === '480') {
    return 'bv*[height<=480]+ba/b[height<=480]/bv*+ba/b';
  }
  if (quality === '720') {
    return 'bv*[height<=720]+ba/b[height<=720]/bv*+ba/b';
  }
  // boshqa platformalar: birlashgan bo'lsa o'shani, aks holda merge
  return 'b/bv*+ba/best';
}

// 50MB dan katta bo'lsa avtomatik pasaytirish uchun keyingi sifat.
const NEXT_LOWER_QUALITY = { best: '720', 720: '480', 480: '360', 360: null };
function nextLowerQuality(quality) {
  return NEXT_LOWER_QUALITY[quality] || null;
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
    // MP3: faqat audio + ffmpeg orqali konvertatsiya (forgiving selektor)
    args.push(
      '-f',
      'ba/bestaudio/best',
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
    if (isFormatError(combined)) {
      await dumpFormats(url); // diagnostika: aynan qanday formatlar bor?
    }
    if (isNoVideo(combined)) {
      throw new NoVideoError();
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

// ---- Metadata (probe) ----------------------------------------------------

// URL uchun title/uploader/duration ni oladi (audio metadata uchun).
async function probe(url) {
  const args = [
    ...commonArgs(),
    '--print',
    '%(title)s\n%(uploader)s\n%(duration)s',
    url,
  ];
  try {
    const { stdout } = await runYtDlp(args, { timeout: 60000 });
    const [title = '', uploader = '', duration = ''] = stdout.split('\n');
    return {
      title: title.trim() && title.trim() !== 'NA' ? title.trim() : '',
      uploader: uploader.trim() && uploader.trim() !== 'NA' ? uploader.trim() : '',
      duration: parseInt(duration, 10) || 0,
    };
  } catch (_) {
    return { title: '', uploader: '', duration: 0 };
  }
}

// ---- Audio (MP3) ---------------------------------------------------------

/**
 * URL'dan MP3 audio yuklaydi (metadata bilan).
 * @param {string} url
 * @param {object} known — oldindan ma'lum meta { title, uploader, duration }
 * @returns {Promise<{ filePath, size, token, title, performer, duration }>}
 */
async function downloadAudio(url, known = {}) {
  const token = makeToken();
  const dir = config.DOWNLOADS_DIR;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Metadata: qidiruvdan kelgan bo'lsa ishlatamiz, aks holda probe qilamiz.
  let meta = {
    title: known.title || '',
    uploader: known.uploader || '',
    duration: known.duration || 0,
  };
  if (!meta.title) {
    meta = await probe(url);
  }

  const outputTemplate = path.join(dir, `${token}.%(ext)s`);
  const args = [
    ...commonArgs(),
    '-o',
    outputTemplate,
    '-f',
    'ba/bestaudio/best',
    '--extract-audio',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '0',
    '--embed-metadata',
    url,
  ];

  try {
    // Audio yuklashga aniq 120s timeout — cheksiz "yuklanmoqda" holatini oldini oladi.
    await runYtDlp(args, { timeout: 120000 });
  } catch (err) {
    const combined = `${err.stderr || ''}\n${err.stdout || ''}\n${err.message || ''}`;
    // yt-dlp stderr'ini to'liq log qilamiz (diagnostika uchun).
    console.error(
      `[downloadAudio] xato url=${url}\n  killed=${err.killed || false} signal=${err.signal || '-'}\n  STDERR: ${err.stderr || '(bo\'sh)'}`
    );
    cleanupToken(dir, token);
    if (isBotCheck(combined)) throw new BotCheckError();
    if (isFormatError(combined)) {
      await dumpFormats(url); // diagnostika: aynan qanday formatlar bor?
    }
    if (err.killed || err.signal === 'SIGTERM') {
      const e = new Error('AUDIO_TIMEOUT');
      e.code = 'TIMEOUT';
      throw e;
    }
    throw err;
  }

  const filePath = findOutputFile(dir, token);
  if (!filePath) throw new Error('AUDIO_TOPILMADI');

  const size = fs.statSync(filePath).size;
  if (size > MAX_BYTES) {
    cleanupToken(dir, token);
    throw new TooLargeError(Math.round((size / (1024 * 1024)) * 10) / 10);
  }

  return {
    filePath,
    size,
    token,
    title: meta.title || 'Audio',
    performer: meta.uploader || '',
    duration: meta.duration || 0,
  };
}

// ---- Qidiruv -------------------------------------------------------------

/**
 * yt-dlp orqali musiqa qidiradi.
 * @param {string} query
 * @param {string} provider — 'sc' (SoundCloud) yoki 'yt' (YouTube)
 * @param {number} limit
 * @returns {Promise<Array<{ title, uploader, duration, url }>>}
 */
async function search(query, provider = 'sc', limit = 15) {
  const prefix = provider === 'yt' ? 'ytsearch' : 'scsearch';
  const term = `${prefix}${limit}:${query}`;
  const args = [...commonArgs(), '--flat-playlist', '--dump-json', term];

  const { stdout } = await runYtDlp(args, { timeout: 60000 });
  const results = [];
  for (const line of stdout.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const j = JSON.parse(t);
      // Yuklab olinadigan to'g'ri URL: webpage_url ustun, keyin url/permalink.
      // "scsearch..:query" turidagi qidiruv qatori EMAS, haqiqiy https URL kerak.
      let url = j.webpage_url || j.url || j.permalink_url || '';
      if (url && !/^https?:\/\//i.test(url)) {
        // to'liq URL emas — YouTube uchun id'dan quramiz, aks holda tashlaymiz
        if (provider === 'yt' || /youtube/i.test(String(j.ie_key || ''))) {
          url = j.id ? `https://www.youtube.com/watch?v=${j.id}` : '';
        } else {
          url = '';
        }
      }
      // Xavfsizlik: qidiruv-qatorini (scsearch:/ytsearch:) URL sifatida saqlamaymiz.
      if (/^(sc|yt)search/i.test(url)) url = '';
      if (url) {
        results.push({
          title: j.title || '(nomsiz)',
          uploader: j.uploader || j.channel || j.uploader_id || '',
          duration: j.duration || 0,
          url,
        });
      }
    } catch (_) {
      /* buzuq qatorni tashlab ketamiz */
    }
  }
  return results;
}

// ---- Rasm (gallery-dl) ---------------------------------------------------

function runGalleryDl(args, { timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      config.GALLERY_DL_PATH,
      args,
      { timeout, maxBuffer: 1024 * 1024 * 20 },
      (err, stdout, stderr) => {
        if (err) {
          err.stdout = (stdout || '').toString();
          err.stderr = (stderr || '').toString();
          return reject(err);
        }
        resolve({ stdout: (stdout || '').toString(), stderr: (stderr || '').toString() });
      }
    );
  });
}

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];

// Papkani rekursiv aylanib rasm fayllarini yig'amiz.
function collectImages(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      collectImages(full, acc);
    } else if (IMAGE_EXT.includes(path.extname(name).toLowerCase()) && st.size <= MAX_BYTES) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * gallery-dl orqali rasm(lar)ni yuklaydi.
 * @returns {Promise<{ files: string[], token: string, dir: string }>}
 */
async function downloadImages(url, { max = 10 } = {}) {
  const token = makeToken();
  const dir = path.join(config.DOWNLOADS_DIR, token);
  fs.mkdirSync(dir, { recursive: true });

  const args = ['-D', dir, '--range', `1-${max}`];
  if (config.YTDLP_PROXY) args.push('--proxy', config.YTDLP_PROXY);
  if (hasCookies()) args.push('--cookies', config.YTDLP_COOKIES);
  args.push(url);

  await runGalleryDl(args);

  const files = collectImages(dir).slice(0, max);
  return { files, token, dir };
}

// Rasm papkasini butunlay o'chirish.
function removeDir(dir) {
  try {
    if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {
    /* ignore */
  }
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
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          fs.rmSync(full, { recursive: true, force: true });
        } else {
          fs.unlinkSync(full);
        }
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
  downloadAudio,
  downloadImages,
  search,
  probe,
  removeFile,
  removeDir,
  cleanDownloadsDir,
  makeToken,
  hasCookies,
  videoFormatFor,
  nextLowerQuality,
  BotCheckError,
  TooLargeError,
  NoVideoError,
  MAX_MB,
};
