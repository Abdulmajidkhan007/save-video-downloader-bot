'use strict';

let botUsername = '';
const setBotUsername = (u) => { botUsername = u; };
const getBotUsername = () => botUsername;

const linkFor = (code) => `https://t.me/${botUsername}?start=${code}`;

function shareKeyboard(code) {
  const url = linkFor(code);
  const shareUrl =
    `https://t.me/share/url?url=${encodeURIComponent(url)}` +
    `&text=${encodeURIComponent("Menga anonim xabar yuboring! 👇")}`;
  return { inline_keyboard: [[{ text: "🔗 Ulashish", url: shareUrl }]] };
}

function linkBlock(user) {
  return (
    `🔗 *Shaxsiy havolangiz:*\n${linkFor(user.code)}\n\n` +
    "Havolani ulashib, sizga ham anonim xabar yuborishsin!"
  );
}

// Har anonim xabar ostida: Bloklash + Shikoyat
function anonActionKeyboard(senderId) {
  return {
    inline_keyboard: [[
      { text: "🚫 Bloklash", callback_data: `b:${senderId}` },
      { text: "🚩 Shikoyat", callback_data: `r:${senderId}` },
    ]],
  };
}

// Majburiy kanal obunasi klaviaturasi
function channelSubKeyboard(channels) {
  const rows = channels.map((ch) => {
    let url = '#';
    if (ch.username) url = `https://t.me/${ch.username}`;
    else if (ch.invite_link) url = ch.invite_link;
    else if (ch.id) url = `https://t.me/c/${String(ch.id).replace('-100', '')}`;
    return [{ text: `📺 ${ch.title || ch.username || ch.id}`, url }];
  });
  rows.push([{ text: "✅ Tekshirish", callback_data: "chk" }]);
  return { inline_keyboard: rows };
}

// Admin paneli
function adminPanelKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📊 Statistika", callback_data: "a:stats" }, { text: "👥 Foydalanuvchilar", callback_data: "a:users:0" }],
      [{ text: "📢 Broadcast", callback_data: "a:bc" }],
      [{ text: "🚫 Banlar", callback_data: "a:bans" }, { text: "📺 Kanallar", callback_data: "a:ch" }],
    ],
  };
}

// Foydalanuvchi nomidan markdown-buzar belgilarni olib tashlash
function safeName(s) {
  return String(s || '').replace(/[_*`\[\]]/g, '').slice(0, 50);
}

// Markdown maxsus belgilarini escape qilish (username uchun: @some_user → @some\_user)
function escMd(s) {
  if (s == null) return '';
  return String(s).replace(/([_*`\[])/g, '\\$1');
}

module.exports = {
  setBotUsername, getBotUsername,
  linkFor, shareKeyboard, linkBlock,
  anonActionKeyboard, channelSubKeyboard, adminPanelKeyboard,
  safeName, escMd,
};
