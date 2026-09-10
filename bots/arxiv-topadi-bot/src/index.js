'use strict';

// O'chgan xabarlarni tiklash — qo'llanma-bot.
// Polling rejimida ishlaydi. State saqlamaydi.
// MUHIM: bot HECH KIMDAN telefon/kod/2FA so'ramaydi — faqat yo'l-yo'riq beradi.

const TelegramBot = require('node-telegram-bot-api');
const { STEPS } = require('./steps');
const { stepKeyboard, startKeyboard } = require('./keyboard');
const { buildScript } = require('./script');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('Xato: BOT_TOKEN muhit o‘zgaruvchisi berilmagan.');
  console.error('Ishga tushirish: BOT_TOKEN=... node src/index.js');
  process.exit(1);
}

const SCRIPT_STEP = 5; // 6-qadam (0-indeksli) — bu yerda recover.py yuboriladi.

const bot = new TelegramBot(TOKEN, { polling: true });

const WELCOME =
  '👋 <b>Salom!</b>\n\n' +
  'Men guruhda adashib <b>o‘chib ketgan xabarlarni</b> tiklashni ' +
  'bosqichma-bosqich o‘rgataman (Termux + Ubuntu + Python + Telethon).\n\n' +
  '🔒 Men <b>hech qachon</b> telefon, login kod yoki 2FA parolingni so‘ramayman. ' +
  'Faqat yo‘l-yo‘riq beraman — hamma amal o‘z qurilmangda bajariladi.\n\n' +
  'Boshlaymizmi?';

// recover.py faylini foydalanuvchiga yuborish.
function sendScriptFile(chatId) {
  const buffer = Buffer.from(buildScript(), 'utf-8');
  return bot.sendDocument(
    chatId,
    buffer,
    { caption: '📄 recover.py — nano’ga shu faylning ichini joyla.' },
    { filename: 'recover.py', contentType: 'text/x-python' }
  );
}

// Berilgan indeksli qadamni ko'rsatish (xabarni tahrirlab).
async function showStep(chatId, messageId, index) {
  const step = STEPS[index];
  const opts = {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: stepKeyboard(index, STEPS.length),
  };
  try {
    await bot.editMessageText(step.html, opts);
  } catch (err) {
    // "message is not modified" kabi xatolarni jim o'tkazamiz.
    if (!String(err.message || err).includes('message is not modified')) {
      console.error('editMessageText xato:', err.message || err);
    }
  }
}

bot.onText(/^\/start\b/, (msg) => {
  bot.sendMessage(msg.chat.id, WELCOME, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: startKeyboard(),
  });
});

bot.onText(/^\/help\b/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    'Boshlash uchun /start ni bosing. Tugmalar bilan qadamlar orasida yuring.'
  );
});

bot.on('callback_query', async (query) => {
  const data = query.data || '';
  const chatId = query.message && query.message.chat.id;
  const messageId = query.message && query.message.message_id;

  if (data === 'noop') {
    return bot.answerCallbackQuery(query.id);
  }

  const m = data.match(/^step:(\d+)$/);
  if (!m || chatId == null) {
    return bot.answerCallbackQuery(query.id);
  }

  let index = parseInt(m[1], 10);
  if (index < 0) index = 0;
  if (index >= STEPS.length) index = STEPS.length - 1;

  await showStep(chatId, messageId, index);

  // 6-qadamga (skript) yetganda recover.py faylini yuboramiz.
  if (index === SCRIPT_STEP) {
    try {
      await sendScriptFile(chatId);
    } catch (err) {
      console.error('sendDocument xato:', err.message || err);
    }
  }

  bot.answerCallbackQuery(query.id);
});

bot.on('polling_error', (err) => {
  console.error('polling_error:', err.message || err);
});

console.log('Bot ishga tushdi (polling). To‘xtatish: Ctrl+C');
