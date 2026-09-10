'use strict';

// ---- Obuna tekshiruv klaviaturasi ----
function subscriptionKeyboard(missingChannels) {
  const rows = missingChannels.map((c) => {
    const url = c.username
      ? `https://t.me/${c.username.replace(/^@/, '')}`
      : c.invite_link || 'https://t.me/';
    return [{ text: `📢 ${c.title || c.username || c.id}`, url }];
  });
  rows.push([{ text: '✅ Obunani tekshirish', callback_data: 'sub:check' }]);
  return { reply_markup: { inline_keyboard: rows } };
}

// ---- /search — qidiruv usuli menyusi (inline) ----
function searchMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔢 User ID orqali', callback_data: 'search:by_id' }],
        [{ text: '📛 Username orqali', callback_data: 'search:by_username' }],
        [{ text: '📞 Telefon (kontakt) orqali', callback_data: 'search:by_phone' }],
      ],
    },
  };
}

// ---- /getid — barcha 3 ta request tugmasi bitta reply keyboard ----
function getIdKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [
          {
            text: '📢 Kanal',
            request_chat: { request_id: 1, chat_is_channel: true },
          },
          {
            text: '👥 Guruh',
            request_chat: { request_id: 2, chat_is_channel: false },
          },
        ],
        [
          {
            text: '👤 Foydalanuvchi',
            request_users: { request_id: 3, user_is_bot: false, max_quantity: 1 },
          },
        ],
        [{ text: '❌ Bekor qilish' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
}

// ---- Kontakt ulashish (telefon orqali qidiruv uchun) ----
function contactKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '📲 Kontakt ulashish', request_contact: true }],
        [{ text: '❌ Bekor qilish' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
}

// ---- Reply keyboardni olib tashlash ----
function removeKeyboard() {
  return { reply_markup: { remove_keyboard: true } };
}

// ---- "Botni qo'shish" inline tugmasi (bot chatga a'zo bo'lmaganda) ----
// type: 'channel' → kanalga admin; aks holda guruhga qo'shish.
function addToChatKeyboard(username, type) {
  const isChannel = type === 'channel';
  const param = isChannel ? 'startchannel' : 'startgroup';
  const label = isChannel ? '➕ Botni kanalga admin qiling' : '➕ Botni guruhga qo\'shish';
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: label, url: `https://t.me/${username}?${param}=true` }],
      ],
    },
  };
}

// ---- Admin panel ----
function adminMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 Statistika', callback_data: 'admin:stats' }],
        [{ text: '📢 Majburiy kanallar', callback_data: 'admin:channels' }],
        [{ text: '📣 Broadcast', callback_data: 'admin:broadcast' }],
        [{ text: '👥 Foydalanuvchilar', callback_data: 'admin:users' }],
      ],
    },
  };
}

// Admin: kanallar boshqaruvi.
function adminChannelsMenu(channels) {
  const rows = channels.map((c) => [
    {
      text: `🗑 ${c.title || c.username || c.id}`,
      callback_data: `admin:chan_del:${c.id}`,
    },
  ]);
  rows.push([{ text: '➕ Kanal qo\'shish', callback_data: 'admin:chan_add' }]);
  rows.push([{ text: '⬅️ Orqaga', callback_data: 'admin:menu' }]);
  return { reply_markup: { inline_keyboard: rows } };
}

module.exports = {
  subscriptionKeyboard,
  searchMenu,
  getIdKeyboard,
  contactKeyboard,
  removeKeyboard,
  addToChatKeyboard,
  adminMenu,
  adminChannelsMenu,
};
