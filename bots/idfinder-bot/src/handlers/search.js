'use strict';

const storage = require('../utils/storage');
const keyboards = require('../utils/keyboards');
const state = require('../utils/state');
const { formatChat, formatUserId } = require('../utils/format');

// Qidiruv menyusi (callback: search:menu).
async function showSearchMenu(bot, query) {
  await bot.answerCallbackQuery(query.id);
  await bot.editMessageText(
    '🔍 <b>Foydalanuvchini qidirish</b>\n\nUsulni tanlang:',
    {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      ...keyboards.searchMenu(),
    }
  );
}

// search:by_id
async function promptById(bot, query) {
  const chatId = query.message.chat.id;
  state.set(query.from.id, { action: 'search_id' });
  await bot.answerCallbackQuery(query.id);
  await bot.sendMessage(
    chatId,
    '🔢 Qidirmoqchi bo\'lgan foydalanuvchining <b>raqamli ID</b>sini yuboring:\n' +
      '<i>Masalan:</i> <code>123456789</code>',
    { parse_mode: 'HTML' }
  );
}

// search:by_username
async function promptByUsername(bot, query) {
  const chatId = query.message.chat.id;
  state.set(query.from.id, { action: 'search_username' });
  await bot.answerCallbackQuery(query.id);
  await bot.sendMessage(
    chatId,
    '📛 <b>Username</b>ni yuboring:\n<i>Masalan:</i> <code>@durov</code>',
    { parse_mode: 'HTML' }
  );
}

// search:by_phone
async function promptByPhone(bot, query) {
  const chatId = query.message.chat.id;
  state.set(query.from.id, { action: 'search_phone' });
  await bot.answerCallbackQuery(query.id);
  await bot.sendMessage(
    chatId,
    '📞 <b>Telefon orqali qidirish</b>\n\n' +
      'Quyidagi tugma orqali kontakt ulashing. Bot kontaktdagi ' +
      'foydalanuvchi ID sini qaytaradi.\n\n' +
      '⚠️ <i>Eslatma:</i> Telegram cheklovi sababli ixtiyoriy telefon raqamini ' +
      'matn sifatida yozib qidirib bo\'lmaydi — faqat kontakt ulashish orqali ishlaydi.',
    { parse_mode: 'HTML', ...keyboards.contactKeyboard() }
  );
}

// getChat xatosini turkumlab, foydalanuvchiga tushunarli xabar qaytaradi.
function explainLookupError(err, queryValue) {
  const desc =
    (err.response && err.response.body && err.response.body.description) ||
    err.message ||
    '';
  const d = desc.toLowerCase();

  // Eng ko'p uchraydigan holat: bot bu entity'ni hali "ko'rmagan".
  if (d.includes('chat not found')) {
    const isUsername = typeof queryValue === 'string' && queryValue.startsWith('@');
    return (
      '❌ <b>Topilmadi.</b>\n\n' +
      (isUsername
        ? 'Bu <b>username</b> mavjud emas, yoki egasi uni yaqinda o\'zgartirgan, ' +
          'yoki bu <b>maxfiy (private)</b> akkaunt/kanal.\n\n'
        : 'Bu <b>raqamli ID</b> bo\'yicha bot ma\'lumot ololmadi.\n\n') +
      'ℹ️ <b>Nega?</b> Telegram Bot API maxfiylik uchun faqat bot <b>oldin ko\'rgan</b> ' +
      '(sizga yozgan, umumiy guruhda bo\'lgan) yoki <b>ochiq (public)</b> ' +
      'foydalanuvchi/kanallarni topa oladi. Ixtiyoriy shaxsni ID yoki username ' +
      'orqali qidirish Bot API\'da <b>ataylab cheklangan</b>.\n\n' +
      '✅ <b>Ishonchli yo\'l:</b> /getid — kanal, guruh yoki foydalanuvchini ' +
      'tugma orqali tanlang, yoki undan xabar <b>forward</b> qiling.'
    );
  }

  if (d.includes('user_id_invalid') || d.includes('invalid')) {
    return '❌ ID yoki username formati noto\'g\'ri ko\'rinadi. Tekshirib qayta yuboring.';
  }

  if (d.includes('too many requests') || d.includes('retry')) {
    return '⏳ Hozir so\'rovlar ko\'p. Bir oz kuting va qayta urinib ko\'ring.';
  }

  return '❌ Topilmadi.\n\n<i>Sabab:</i> ' + (desc || 'noma\'lum xato');
}

// getChat orqali lookup (ID yoki @username).
async function lookup(bot, chatId, queryValue) {
  try {
    const chat = await bot.getChat(queryValue);
    const extra = {};
    // Kanal/guruh bo'lsa a'zolar sonini ham qo'shamiz.
    if (chat.type && chat.type !== 'private') {
      try {
        extra.member_count = await bot.getChatMemberCount(chat.id);
      } catch (_) {
        /* ololmasak — ko'rsatmaymiz */
      }
    }
    await bot.sendMessage(chatId, formatChat(chat, extra), {
      parse_mode: 'HTML',
      ...keyboards.removeKeyboard(),
    });
  } catch (err) {
    await bot.sendMessage(chatId, explainLookupError(err, queryValue), {
      parse_mode: 'HTML',
      ...keyboards.removeKeyboard(),
    });
  }
}

// Matnli kiritishni qayta ishlaydi (state ga qarab). Ishladimi — true qaytaradi.
async function handleTextInput(bot, msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const st = state.get(userId);
  if (!st) return false;

  const text = (msg.text || '').trim();

  if (st.action === 'search_id') {
    state.clear(userId);
    if (!/^-?\d+$/.test(text)) {
      await bot.sendMessage(
        chatId,
        '❌ Bu raqamli ID emas. Faqat raqam yuboring, masalan: <code>123456789</code>',
        { parse_mode: 'HTML' }
      );
      return true;
    }
    storage.incStat('searches', 'by_id');
    await lookup(bot, chatId, Number(text));
    return true;
  }

  if (st.action === 'search_username') {
    state.clear(userId);
    let uname = text;
    if (!uname.startsWith('@')) uname = '@' + uname;
    if (!/^@[A-Za-z0-9_]{4,}$/.test(uname)) {
      await bot.sendMessage(
        chatId,
        '❌ Username noto\'g\'ri ko\'rinishda. Masalan: <code>@durov</code>',
        { parse_mode: 'HTML' }
      );
      return true;
    }
    storage.incStat('searches', 'by_username');
    await lookup(bot, chatId, uname);
    return true;
  }

  return false;
}

// Kontakt ulashilganda (msg.contact). Telefon orqali qidiruv natijasi.
async function handleContact(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  state.clear(userId);
  storage.incStat('searches', 'by_phone');

  const contact = msg.contact;
  if (contact.user_id) {
    await bot.sendMessage(
      chatId,
      formatUserId(contact.user_id, {
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone_number: contact.phone_number,
      }),
      { parse_mode: 'HTML', ...keyboards.removeKeyboard() }
    );
  } else {
    await bot.sendMessage(
      chatId,
      'ℹ️ Bu raqam Telegram\'da yo\'q yoki maxfiylik sozlamalari sababli ' +
        'foydalanuvchi ID si ko\'rsatilmaydi.',
      { parse_mode: 'HTML', ...keyboards.removeKeyboard() }
    );
  }
}

module.exports = {
  showSearchMenu,
  promptById,
  promptByUsername,
  promptByPhone,
  handleTextInput,
  handleContact,
};
