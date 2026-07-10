'use strict';

const storage = require('../services/storage');
const { PLATFORMS } = require('../utils/platform');
const { addToGroupKeyboard } = require('../utils/keyboard');

let BOT_USERNAME = '';
function setBotUsername(username) {
  BOT_USERNAME = username || '';
}

// /start — salomlashish + foydalanuvchini ro'yxatga qo'shish.
async function handleStart(bot, msg) {
  storage.upsertUser(msg.from);
  const name = msg.from.first_name || 'do\'st';
  const text =
    `Assalomu alaykum, ${name}! 👋\n\n` +
    '🎬 Men video yuklovchi botman. Menga quyidagi platformalardan havola yuboring — ' +
    'videoni yuklab beraman:\n\n' +
    '• Instagram\n• TikTok\n• YouTube (video + MP3)\n• Facebook\n' +
    '• Twitter/X\n• Pinterest (rasm)\n• Likee\n\n' +
    '🎵 Qo\'shiq nomini yozsangiz — topib beraman.\n' +
    '🎧 Ovozli xabar yuborsangiz — musiqani aniqlayman.\n\n' +
    '📎 Havolani yoki qo\'shiq nomini shu yerga tashlang!';
  const keyboard = addToGroupKeyboard(BOT_USERNAME);
  await bot.sendMessage(msg.chat.id, text, keyboard ? { reply_markup: keyboard } : {});
}

// /help — qo'llab-quvvatlanadigan platformalar.
async function handleHelp(bot, msg) {
  storage.upsertUser(msg.from);
  const list = PLATFORMS.map((p) => `• ${p.label}`).join('\n');
  const text =
    'ℹ️ <b>Yordam</b>\n\n' +
    'Menga video havolasini yuboring, men uni yuklab beraman.\n\n' +
    '<b>Qo\'llab-quvvatlanadigan platformalar:</b>\n' +
    list +
    '\n\n<b>Qanday ishlataman?</b>\n' +
    '🔗 Havola yuboring — video/rasm yuklab beraman\n' +
    '🎵 Har video ostidagi «Audio (MP3)» tugmasi bilan audio oling\n' +
    '🔎 Qo\'shiq nomini yozing — topib beraman\n' +
    '🎧 Ovozli xabar yuboring — musiqani aniqlayman (Shazam kabi)\n' +
    '➕ Meni guruhga ham qo\'shishingiz mumkin\n\n' +
    '<b>Buyruqlar:</b>\n' +
    '/start — botni ishga tushirish\n' +
    '/stats — shaxsiy statistikangiz\n' +
    '/help — ushbu yordam\n\n' +
    'ℹ️ YouTube uchun video yoki MP3 (audio) tanlash mumkin.\n' +
    'ℹ️ Fayl hajmi 50MB dan oshsa, Telegram orqali yuborib bo\'lmaydi.';
  await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
}

// /stats — foydalanuvchining shaxsiy statistikasi.
async function handleUserStats(bot, msg) {
  const user = storage.upsertUser(msg.from);
  const downloads = (user && user.downloads) || 0;
  const joined = user && user.joinedAt ? user.joinedAt.slice(0, 10) : '-';
  const text =
    '📊 <b>Sizning statistikangiz</b>\n\n' +
    `📥 Yuklangan videolar: <b>${downloads}</b>\n` +
    `📅 Ro'yxatdan o'tgan sana: ${joined}`;
  await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
}

module.exports = { handleStart, handleHelp, handleUserStats, setBotUsername };
