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
function subscriptionKeyboard(channels) {
  const rows = channels
    .filter((c) => c.username)
    .map((c) => [
      {
        text: `📢 ${c.title || c.username}`,
        url: `https://t.me/${String(c.username).replace(/^@/, '')}`,
      },
    ]);
  rows.push([{ text: '✅ Obunani tekshirish', callback_data: 'check_sub' }]);
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

module.exports = {
  youtubeFormatKeyboard,
  subscriptionKeyboard,
  adminMenuKeyboard,
  adminChannelsKeyboard,
  broadcastModeKeyboard,
  backToMenuKeyboard,
};
