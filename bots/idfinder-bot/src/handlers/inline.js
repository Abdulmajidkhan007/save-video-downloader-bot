'use strict';

const storage = require('../utils/storage');
const { checkSubscription } = require('../utils/subscription');
const { formatChat } = require('../utils/format');

// Har bir inline javob ustida ko'rinadigan "Botni ochish" tugmasi.
// switch_pm — bosilganda botning shaxsiy chatini /start bilan ochadi.
const OPEN_BOT_BUTTON = {
  switch_pm_text: '🔍 Botni ochish',
  switch_pm_parameter: 'from_inline',
};

// answerInlineQuery ni standart sozlamalar bilan chaqiradi.
function answer(bot, iq, results, extra = {}) {
  return bot.answerInlineQuery(iq.id, results, {
    cache_time: 5,
    is_personal: true,
    ...OPEN_BOT_BUTTON,
    ...extra,
  });
}

// Inline natija (article) yasash yordamchisi.
function article(id, title, description, messageText) {
  return {
    type: 'article',
    id: String(id),
    title,
    description,
    input_message_content: {
      message_text: messageText,
      parse_mode: 'HTML',
    },
  };
}

// Foydalanuvchining o'z ma'lumotini article sifatida.
function selfResult(from) {
  const text =
    '👤 <b>Sizning ma\'lumotlaringiz</b>\n\n' +
    `🆔 ID: <code>${from.id}</code>\n` +
    (from.username ? `📛 Username: @${from.username}\n` : '') +
    (from.first_name ? `👤 Ism: ${from.first_name}\n` : '');
  return article('self', '👤 Mening ID\'im', `ID: ${from.id}`, text);
}

// inline_query handler.
// Bo'sh so'rov → foydalanuvchining o'z ID'i.
// @username yoki raqamli ID → public/ko'rilgan entity'ni getChat orqali qidiradi.
async function handleInlineQuery(bot, iq) {
  const q = (iq.query || '').trim();

  // Obuna talab qilinsa va a'zo bo'lmasa — botga yo'naltiruvchi natija.
  const { ok } = await checkSubscription(bot, iq.from.id);
  if (!ok) {
    return answer(bot, iq, [
      article(
        'need_sub',
        '🔒 Avval obuna bo\'ling',
        'Botni oching va majburiy kanallarga a\'zo bo\'ling',
        '🔒 Botdan foydalanish uchun uni oching va majburiy kanallarga a\'zo bo\'ling.'
      ),
    ]);
  }

  // Bo'sh so'rov — o'z ID.
  if (!q) {
    storage.incStat('inline', 'self');
    return answer(bot, iq, [selfResult(iq.from)]);
  }

  // @username yoki raqamli ID ni aniqlash.
  let target = null;
  if (/^-?\d+$/.test(q)) {
    target = Number(q);
  } else {
    const uname = q.startsWith('@') ? q : '@' + q;
    if (/^@[A-Za-z0-9_]{4,}$/.test(uname)) target = uname;
  }

  if (target === null) {
    return answer(bot, iq, [
      article(
        'hint',
        'ℹ️ @username yoki raqamli ID yozing',
        'Masalan: @durov yoki 123456789',
        'ℹ️ Inline qidiruv uchun @username yoki raqamli ID yozing.'
      ),
    ]);
  }

  try {
    const chat = await bot.getChat(target);
    storage.incStat('inline', typeof target === 'number' ? 'by_id' : 'by_username');
    const text = formatChat(chat);
    const title =
      (chat.title || chat.first_name || String(chat.id)) +
      (chat.username ? ` (@${chat.username})` : '');
    return answer(bot, iq, [article(chat.id, `🆔 ${title}`, `ID: ${chat.id}`, text)], {
      cache_time: 10,
    });
  } catch (_) {
    return answer(bot, iq, [
      article(
        'notfound',
        '❌ Topilmadi',
        'Public emas yoki bot uni ko\'rmagan',
        '❌ Topilmadi. Faqat <b>public</b> yoki bot oldin ko\'rgan foydalanuvchi/kanallar ' +
          'inline orqali topiladi. Aniqroq ma\'lumot uchun botni oching va /getid dan foydalaning.'
      ),
    ]);
  }
}

module.exports = { handleInlineQuery };
