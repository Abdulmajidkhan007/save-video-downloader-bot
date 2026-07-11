'use strict';

// Inline keyboardlarni bitta joyda saqlaymiz.

// YouTube uchun format tanlash tugmalari.
// callback_data formati: "yt|<action>|<token>"
function youtubeFormatKeyboard(token) {
  return {
    inline_keyboard: [
      [
        { text: '🎬 360p', callback_data: `yt|360|${token}` },
        { text: '🎬 720p', callback_data: `yt|720|${token}` },
      ],
      [{ text: '🎵 MP3 (audio)', callback_data: `yt|mp3|${token}` }],
    ],
  };
}

// Majburiy obuna: kanal tugmalari + tekshirish tugmasi.
// userId berilsa — tugma faqat o'sha user uchun (check_sub:<uid>).
function subscriptionKeyboard(channels, userId) {
  const rows = channels
    .filter((c) => c.username)
    .map((c) => [
      {
        text: `📢 ${c.title || c.username}`,
        url: `https://t.me/${String(c.username).replace(/^@/, '')}`,
      },
    ]);
  const cb = userId ? `check_sub:${userId}` : 'check_sub';
  rows.push([{ text: '✅ Obunani tekshirish', callback_data: cb }]);
  return { inline_keyboard: rows };
}

// Admin panel asosiy menyusi.
function adminMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📊 Statistika', callback_data: 'admin|stats' },
        { text: '📢 Broadcast', callback_data: 'admin|broadcast' },
      ],
      [
        { text: '📣 Kanallar', callback_data: 'admin|channels' },
        { text: '👥 Foydalanuvchilar', callback_data: 'admin|users' },
      ],
      [
        { text: '👥 Guruhlar', callback_data: 'admin|groups' },
        { text: '👤 User qidirish', callback_data: 'admin|finduser' },
      ],
      [
        { text: '🚦 Limitlar', callback_data: 'admin|limits' },
        { text: '🧾 Loglar', callback_data: 'admin|logs' },
      ],
    ],
  };
}

// Kanallar boshqaruvi menyusi.
function adminChannelsKeyboard(channels) {
  const rows = channels.map((c) => [
    {
      text: `🗑 ${c.title || c.username || c.id}`,
      callback_data: `admin|delchan|${c.id}`,
    },
  ]);
  rows.push([{ text: '➕ Kanal qo\'shish', callback_data: 'admin|addchan' }]);
  rows.push([{ text: '⬅️ Orqaga', callback_data: 'admin|menu' }]);
  return { inline_keyboard: rows };
}

// Broadcast maqsadini tanlash: userlar / guruhlar / hammasi.
function broadcastTargetKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '👤 Faqat userlar', callback_data: 'admin|bc_target|users' }],
      [{ text: '👥 Faqat guruhlar', callback_data: 'admin|bc_target|groups' }],
      [{ text: '📢 Hammasi', callback_data: 'admin|bc_target|all' }],
      [{ text: '❌ Bekor qilish', callback_data: 'admin|menu' }],
    ],
  };
}

// Broadcast rejimini tanlash (maqsad allaqachon tanlangan).
function broadcastModeKeyboard(target) {
  const t = target || 'users';
  return {
    inline_keyboard: [
      [
        { text: '📋 Nusxa (copy)', callback_data: `admin|bc_copy|${t}` },
        { text: '↪️ Forward', callback_data: `admin|bc_forward|${t}` },
      ],
      [{ text: '❌ Bekor qilish', callback_data: 'admin|menu' }],
    ],
  };
}

// Orqaga tugmasi.
function backToMenuKeyboard() {
  return {
    inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'admin|menu' }]],
  };
}

// Yuborilgan video ostidagi "🎵 Audio (MP3)" tugmasi.
// id — urlcache dagi qisqa identifikator.
function audioButtonKeyboard(id) {
  return {
    inline_keyboard: [[{ text: '🎵 Audio (MP3)', callback_data: `mp3:${id}` }]],
  };
}

// Soniyani "3:45" ko'rinishiga aylantirish.
function fmtDuration(sec) {
  const s = parseInt(sec, 10) || 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const SEARCH_PER_PAGE = 5;

// Bitta sahifa natijalar + navigatsiya tugmalari.
// items — BARCHA natijalar [{ id, title, uploader, duration }].
// searchId — urlcache dagi qidiruv sessiyasi ID si. page — 0-asosli.
function searchPageKeyboard(searchId, items, page) {
  const totalPages = Math.max(1, Math.ceil(items.length / SEARCH_PER_PAGE));
  const p = Math.min(Math.max(0, page), totalPages - 1);
  const start = p * SEARCH_PER_PAGE;
  const pageItems = items.slice(start, start + SEARCH_PER_PAGE);

  const rows = pageItems.map((it, i) => {
    const dur = it.duration ? ` (${fmtDuration(it.duration)})` : '';
    const who = it.uploader ? ` — ${it.uploader}` : '';
    let label = `${start + i + 1}. ${it.title}${who}${dur}`;
    if (label.length > 60) label = label.slice(0, 57) + '…';
    return [{ text: label, callback_data: `song:${it.id}` }];
  });

  // Navigatsiya qatori — faqat kerakli tugmalar ko'rsatiladi.
  if (totalPages > 1) {
    const nav = [];
    if (p > 0) nav.push({ text: '⬅️ Oldingi', callback_data: `page:${searchId}:${p - 1}` });
    nav.push({ text: `${p + 1}/${totalPages}`, callback_data: 'noop' });
    if (p < totalPages - 1) {
      nav.push({ text: 'Keyingi ➡️', callback_data: `page:${searchId}:${p + 1}` });
    }
    rows.push(nav);
  }

  return { inline_keyboard: rows };
}

// (Eski) barcha natijalarni bitta ro'yxatda — endi searchPageKeyboard ishlatiladi.
function songResultsKeyboard(items) {
  const rows = items.map((it, i) => {
    const dur = it.duration ? ` (${fmtDuration(it.duration)})` : '';
    const who = it.uploader ? ` — ${it.uploader}` : '';
    let label = `${i + 1}. ${it.title}${who}${dur}`;
    if (label.length > 60) label = label.slice(0, 57) + '…';
    return [{ text: label, callback_data: `song:${it.id}` }];
  });
  return { inline_keyboard: rows };
}

// /start uchun "➕ Guruhga qo'shish" tugmasi.
function addToGroupKeyboard(botUsername) {
  if (!botUsername) return undefined;
  return {
    inline_keyboard: [
      [
        {
          text: '➕ Guruhga qo\'shish',
          url: `https://t.me/${botUsername}?startgroup=true`,
        },
      ],
    ],
  };
}

module.exports = {
  youtubeFormatKeyboard,
  subscriptionKeyboard,
  adminMenuKeyboard,
  adminChannelsKeyboard,
  broadcastTargetKeyboard,
  broadcastModeKeyboard,
  backToMenuKeyboard,
  audioButtonKeyboard,
  songResultsKeyboard,
  searchPageKeyboard,
  addToGroupKeyboard,
  fmtDuration,
};
