'use strict';

const storage = require('../services/storage');
const notify = require('../services/notify');
const { PLATFORMS } = require('../utils/platform');
const { addToGroupKeyboard } = require('../utils/keyboard');

let BOT_USERNAME = '';
function setBotUsername(username) {
  BOT_USERNAME = username || '';
}

// /start payload'idan referrer ID sini ajratadi ("ref_12345" -> "12345").
function parseReferrerId(text) {
  const m = String(text || '').match(/^\/start(?:@\w+)?\s+ref_(\d{1,20})\b/);
  return m ? m[1] : null;
}

// /start — salomlashish + foydalanuvchini ro'yxatga qo'shish (+ referral).
async function handleStart(bot, msg) {
  const referrerId = parseReferrerId(msg.text);
  const user = storage.upsertUser(msg.from, 'private');

  // Referral: faqat YANGI user, referrer mavjud, o'zini emas, bir marta.
  if (referrerId && user.isNew) {
    const res = storage.applyReferral(referrerId, msg.from.id);
    if (res.ok) {
      const newName = msg.from.first_name || (msg.from.username ? '@' + msg.from.username : 'Foydalanuvchi');
      // Referrer'ga xabar (bloklagan bo'lsa — jimgina o'tamiz)
      try {
        await bot.sendMessage(
          referrerId,
          `🎉 Yangi taklif! <b>${escapeHtml(newName)}</b> sizning havolangiz orqali qo'shildi.\n` +
            `Ballaringiz: <b>${res.referrerPoints}</b>`,
          { parse_mode: 'HTML' }
        );
      } catch (_) {
        /* referrer botni bloklagan bo'lishi mumkin */
      }
      const refName =
        res.referrer.firstName || (res.referrer.username ? '@' + res.referrer.username : referrerId);
      notify.notifyAdmins(
        `🔗 <b>Referral</b>: ${escapeHtml(newName)} ← ${escapeHtml(refName)} orqali qo'shildi.\n` +
          `Referrer balli: <b>${res.referrerPoints}</b>`
      );
    }
  }

  const name = msg.from.first_name || 'do\'st';
  const text =
    `Assalomu alaykum, ${name}! 👋\n\n` +
    '🎬 Men video yuklovchi botman. Menga quyidagi platformalardan havola yuboring — ' +
    'videoni yuklab beraman:\n\n' +
    '• Instagram\n• TikTok\n• YouTube (video + MP3)\n• Facebook\n' +
    '• Twitter/X\n• Pinterest (rasm)\n• Likee\n\n' +
    '🎵 Qo\'shiq nomini yozsangiz — topib beraman.\n' +
    '🎧 Ovozli xabar yuborsangiz — musiqani aniqlayman.\n' +
    '🔗 /referral — do\'stlaringni taklif qilib ball to\'plang.\n\n' +
    '📎 Havolani yoki qo\'shiq nomini shu yerga tashlang!';
  const keyboard = addToGroupKeyboard(BOT_USERNAME);
  await bot.sendMessage(msg.chat.id, text, keyboard ? { reply_markup: keyboard } : {});
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(
    /[&<>]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])
  );
}

// /referral — shaxsiy taklif havolasi + ballar.
async function handleReferral(bot, msg) {
  const user = storage.upsertUser(msg.from, 'private');
  const link = `https://t.me/${BOT_USERNAME}?start=ref_${msg.from.id}`;
  const text =
    '🔗 <b>Referral dasturi</b>\n\n' +
    'Do\'stlaringni taklif qil — har biri uchun <b>1 ball</b>!\n\n' +
    `👥 Taklif qilganlaring: <b>${user.referrals || 0}</b>\n` +
    `⭐️ Ballaring: <b>${user.points || 0}</b>\n\n` +
    'Shaxsiy havolang:\n' +
    `<code>${link}</code>`;
  const shareText = `Zo'r video yuklovchi bot! ${link}`;
  await bot.sendMessage(msg.chat.id, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: '📤 Havolani ulashish', switch_inline_query: shareText }]],
    },
  });
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
    '/referral — do\'st taklif qilish\n' +
    '/boglanish — admin bilan bog\'lanish\n' +
    '/help — ushbu yordam\n\n' +
    'ℹ️ YouTube uchun video yoki MP3 (audio) tanlash mumkin.\n' +
    'ℹ️ Fayl hajmi 50MB dan oshsa, Telegram orqali yuborib bo\'lmaydi.';
  await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
}

// /stats — foydalanuvchining shaxsiy statistikasi.
async function handleUserStats(bot, msg) {
  const user = storage.upsertUser(msg.from, 'private');
  const downloads = (user && user.downloads) || 0;
  const joined = user && user.joinedAt ? user.joinedAt.slice(0, 10) : '-';
  const text =
    '📊 <b>Sizning statistikangiz</b>\n\n' +
    `📥 Yuklangan videolar: <b>${downloads}</b>\n` +
    `👥 Taklif qilganlaringiz: <b>${user.referrals || 0}</b>\n` +
    `⭐️ Referral ballari: <b>${user.points || 0}</b>\n` +
    `📅 Ro'yxatdan o'tgan sana: ${joined}`;
  await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
}

module.exports = {
  handleStart,
  handleHelp,
  handleUserStats,
  handleReferral,
  setBotUsername,
};
