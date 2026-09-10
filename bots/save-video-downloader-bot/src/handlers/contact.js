'use strict';

const storage = require('../services/storage');
const notify = require('../services/notify');
const { config, isAdmin } = require('../config');

// Ikki tomonlama admin↔user bog'lanish tizimi.
// Holatlar xotirada saqlanadi (qisqa muddatli — restartda tozalanadi, bu maqbul).
// Faqat message_id→userId mapping doimiy (storage.contactMap) — restartdan keyin
// ham Telegram reply orqali javob berish ishlashi uchun.

const userContactMode = new Set(); // "bog'lanish rejimi"dagi userId lar
const adminReplyTarget = new Map(); // adminId -> targetUserId (javob rejimi)

// Spam limiti: bir user 1 daqiqada max 3 ta murojaat.
const CONTACT_MAX_PER_MIN = 3;
const CONTACT_WINDOW_MS = 60 * 1000;
const contactTimes = new Map(); // userId -> [timestamp]

function checkContactRate(userId) {
  const uid = String(userId);
  const now = Date.now();
  const arr = (contactTimes.get(uid) || []).filter((t) => now - t < CONTACT_WINDOW_MS);
  if (arr.length >= CONTACT_MAX_PER_MIN) {
    contactTimes.set(uid, arr);
    return false;
  }
  arr.push(now);
  contactTimes.set(uid, arr);
  return true;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(
    /[&<>]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])
  );
}

function userLabel(from) {
  const name = from.first_name || '';
  const uname = from.username ? ` (@${from.username})` : '';
  return `${escapeHtml(name)}${escapeHtml(uname)}`;
}

// ---- User tomoni ---------------------------------------------------------

// /boglanish — foydalanuvchini bog'lanish rejimiga o'tkazadi.
async function startContact(bot, chatId, userId) {
  userContactMode.add(String(userId));
  await bot.sendMessage(
    chatId,
    '✍️ Xabaringizni yozing, admin(lar)ga yetkazaman.\n\nBekor qilish: /bekor'
  );
}

// /bekor — bog'lanish rejimini bekor qiladi.
async function cancelContact(bot, msg) {
  const uid = String(msg.from.id);
  if (userContactMode.has(uid)) {
    userContactMode.delete(uid);
    await bot.sendMessage(msg.chat.id, '❌ Bog\'lanish bekor qilindi.');
  } else {
    await bot.sendMessage(msg.chat.id, 'ℹ️ Siz bog\'lanish rejimida emassiz.');
  }
}

function isUserInContact(userId) {
  return userContactMode.has(String(userId));
}

// Bog'lanish rejimidagi user xabarini barcha adminlarga yetkazadi.
async function relayUserMessage(bot, msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (!checkContactRate(userId)) {
    await bot.sendMessage(
      chatId,
      `⏳ Juda ko'p murojaat. 1 daqiqada maksimal ${CONTACT_MAX_PER_MIN} ta. Birozdan so'ng urinib ko'ring.`
    );
    return;
  }

  const header =
    '📩 <b>Yangi murojaat</b>\n' +
    `👤 ${userLabel(msg.from)}\n` +
    `🆔 <code>${userId}</code>`;
  const replyKb = {
    inline_keyboard: [[{ text: '💬 Javob berish', callback_data: `reply:${userId}` }]],
  };

  let delivered = 0;
  for (const adminId of config.ADMIN_IDS) {
    try {
      const info = await bot.sendMessage(adminId, header, {
        parse_mode: 'HTML',
        reply_markup: replyKb,
      });
      // Kontent (matn/rasm/video) — copyMessage bilan
      const copied = await bot.copyMessage(adminId, chatId, msg.message_id);
      // Admin ikkala xabarga ham reply qilib javob bera olsin
      storage.contactMapSet(`${adminId}:${info.message_id}`, userId);
      if (copied && copied.message_id) {
        storage.contactMapSet(`${adminId}:${copied.message_id}`, userId);
      }
      delivered += 1;
    } catch (err) {
      console.error(`[contact] admin ${adminId} ga yetkazilmadi:`, err.message);
    }
  }

  userContactMode.delete(String(userId));

  if (delivered > 0) {
    await bot.sendMessage(chatId, '✅ Xabaringiz yuborildi. Tez orada javob beramiz.');
  } else {
    await bot.sendMessage(chatId, '❌ Hozircha yetkazib bo\'lmadi. Keyinroq urinib ko\'ring.');
  }
}

// ---- Admin tomoni --------------------------------------------------------

// "💬 Javob berish" tugmasi — adminni javob rejimiga o'tkazadi.
async function handleReplyCallback(bot, query, targetUserId) {
  const adminId = query.from.id;
  if (!isAdmin(adminId)) {
    await bot.answerCallbackQuery(query.id, { text: '⛔️ Ruxsat yo\'q', show_alert: true });
    return;
  }
  adminReplyTarget.set(String(adminId), String(targetUserId));
  await bot.answerCallbackQuery(query.id).catch(() => {});
  await bot.sendMessage(
    query.message.chat.id,
    `✍️ <code>${targetUserId}</code> ga javobingizni yozing.\n\nBekor qilish: /bekor`,
    { parse_mode: 'HTML' }
  );
}

// Admin javob rejimida yoki murojaat xabariga reply qilgan bo'lsa — userga yetkazadi.
// Qaytaradi: true (ushlandi) / false.
async function handleAdminMessage(bot, msg) {
  const adminId = String(msg.from.id);
  if (!isAdmin(adminId)) return false;

  // /bekor — javob rejimini bekor qiladi
  if (msg.text && /^\/bekor\b/.test(msg.text)) {
    if (adminReplyTarget.has(adminId)) {
      adminReplyTarget.delete(adminId);
      await bot.sendMessage(msg.chat.id, '❌ Javob bekor qilindi.');
      return true;
    }
    return false;
  }

  let targetUserId = null;

  // 1) Javob rejimida bo'lsa
  if (adminReplyTarget.has(adminId)) {
    targetUserId = adminReplyTarget.get(adminId);
  } else if (msg.reply_to_message) {
    // 2) Murojaat xabariga to'g'ridan-to'g'ri Telegram reply qilgan bo'lsa
    targetUserId = storage.contactMapGet(`${msg.chat.id}:${msg.reply_to_message.message_id}`);
  }

  if (!targetUserId) return false;

  try {
    await bot.sendMessage(targetUserId, '📨 <b>Admin javobi:</b>', { parse_mode: 'HTML' });
    await bot.copyMessage(targetUserId, msg.chat.id, msg.message_id);
    await bot.sendMessage(msg.chat.id, '✅ Javob yuborildi.');
  } catch (err) {
    console.error('[contact] userga javob yetkazilmadi:', err.message);
    await bot.sendMessage(
      msg.chat.id,
      '❌ Javob yetkazilmadi (user botni bloklagan bo\'lishi mumkin).'
    );
  } finally {
    adminReplyTarget.delete(adminId);
  }
  return true;
}

// Admin ayni paytda contact bilan bog'liq holatdami (reply rejimi yoki reply xabari)?
function adminHasContactContext(msg) {
  if (!isAdmin(msg.from.id)) return false;
  if (adminReplyTarget.has(String(msg.from.id))) return true;
  if (msg.reply_to_message) {
    return Boolean(storage.contactMapGet(`${msg.chat.id}:${msg.reply_to_message.message_id}`));
  }
  return false;
}

module.exports = {
  startContact,
  cancelContact,
  isUserInContact,
  relayUserMessage,
  handleReplyCallback,
  handleAdminMessage,
  adminHasContactContext,
};
