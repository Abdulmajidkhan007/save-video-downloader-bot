'use strict';

// URL dan platformani aniqlash. Faqat whitelist regexlar orqali qabul qilamiz —
// shell injection va noma'lum saytlarga so'rov yuborishni oldini olish uchun.

const PLATFORMS = [
  {
    name: 'youtube',
    label: 'YouTube',
    // youtube.com/watch, youtu.be, shorts, m.youtube.com
    regex: /^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?[\w=&%-]*v=|shorts\/|live\/|embed\/)|youtu\.be\/)[\w-]+/i,
  },
  {
    name: 'instagram',
    label: 'Instagram',
    regex: /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|reels|tv)\/[\w-]+/i,
  },
  {
    name: 'tiktok',
    label: 'TikTok',
    // to'liq (www.tiktok.com/@user/video/...) va qisqa (vm/vt.tiktok.com/...)
    regex: /^https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\/[\w@./-]+/i,
  },
  {
    name: 'facebook',
    label: 'Facebook',
    regex: /^https?:\/\/(?:www\.|m\.|web\.|fb\.)?(?:facebook\.com|fb\.watch)\/[\w./?=&%-]+/i,
  },
  {
    name: 'twitter',
    label: 'Twitter/X',
    regex: /^https?:\/\/(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\/[\w./?=&%-]+/i,
  },
  {
    name: 'pinterest',
    label: 'Pinterest',
    regex: /^https?:\/\/(?:www\.|[a-z]{2}\.)?(?:pinterest\.[\w.]+\/pin\/[\w-]+|pin\.it\/[\w-]+)/i,
  },
  {
    name: 'likee',
    label: 'Likee',
    regex: /^https?:\/\/(?:www\.|l\.)?likee\.(?:video|com)\/[\w@./?=&%-]+/i,
  },
];

// Matndan birinchi URL ni ajratib olamiz.
function extractUrl(text) {
  if (!text) return null;
  const match = String(text).match(/https?:\/\/[^\s]+/i);
  return match ? match[0].trim() : null;
}

// URL ga mos platformani qaytaradi yoki null.
function detectPlatform(url) {
  if (!url) return null;
  for (const p of PLATFORMS) {
    if (p.regex.test(url)) {
      return { name: p.name, label: p.label };
    }
  }
  return null;
}

function isYouTube(platformName) {
  return platformName === 'youtube';
}

module.exports = { PLATFORMS, extractUrl, detectPlatform, isYouTube };
