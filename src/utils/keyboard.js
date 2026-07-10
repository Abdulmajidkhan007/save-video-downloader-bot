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

// Broadcast rejimini tanlash.
function broadcastModeKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📋 Nusxa (copy)', callback_data: 'admin|bc_copy' },
        { text: '↪️ Forward', callback_data: 'admin|bc_forward' },
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

// Musiqa qidiruv natijalari — har biri alohida qatorda tugma (song:<id>).
function songResultsKeyboard(items) {
  // items: [{ id, title, uploader, duration }]
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
  broadcastModeKeyboard,
  backToMenuKeyboard,
  audioButtonKeyboard,
  songResultsKeyboard,
  addToGroupKeyboard,
  fmtDuration,
};
