'use strict';

const TG_LIMIT = 4096; // Telegram bitta xabar uchun belgi chegarasi

/**
 * Uzun matnni Telegram chegarasidan kichik bo'laklarga bo'ladi.
 * Iloji bo'lsa qator yoki bo'sh joy bo'yicha bo'ladi.
 */
function splitMessage(text, max = 4000) {
  text = String(text == null ? '' : text);
  if (text.length <= max) return [text];

  const chunks = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(' ', max);
    if (cut < max * 0.5) cut = max; // baribir topilmasa, qattiq kesamiz
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\s+/, '');
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function sendLong(send, chatId, text) {
  for (const chunk of splitMessage(text)) {
    await send.sendMessage(chatId, chunk);
  }
}

const WELCOME =
  "Assalomu alaykum! 🤖\n\n" +
  "Men Gemini AI asosida ishlayman. Istalgan savolingizni yozing — javob beraman.\n\n" +
  "Buyruqlar:\n" +
  "/help — yordam\n" +
  "/reset — suhbatni boshidan boshlash";

const HELP =
  "Shunchaki savolingizni matn ko'rinishida yozing.\n\n" +
  "Men oldingi bir necha xabarni eslab qolaman, shuning uchun suhbatni davom ettira olasiz. " +
  "Yangi mavzuga o'tmoqchi bo'lsangiz, /reset yuboring.\n\n" +
  "Buyruqlar:\n" +
  "/start — boshlash\n" +
  "/help — bu yordam\n" +
  "/reset — kontekstni tozalash";

async function handleStart({ chatId, send }) {
  await send.sendMessage(chatId, WELCOME);
}

async function handleHelp({ chatId, send }) {
  await send.sendMessage(chatId, HELP);
}

async function handleReset({ chatId, send, state }) {
  state.resetHistory(chatId);
  await send.sendMessage(chatId, "Tayyor — suhbat tozalandi. Yangi savol bering. ✨");
}

async function handleStats({ chatId, fromId, send, state, config }) {
  if (!config.adminId || String(fromId) !== String(config.adminId)) {
    await send.sendMessage(chatId, "Bu buyruq faqat admin uchun.");
    return;
  }
  const s = state.getStats();
  await send.sendMessage(
    chatId,
    `📊 Statistika\n\nFoydalanuvchilar: ${s.totalUsers}\nJami xabarlar: ${s.totalMessages}\nIshlash vaqti: ${s.uptimeMin} daqiqa`
  );
}

/**
 * Asosiy savol-javob oqimi.
 * deps: { send, ask, state, rateLimiter, config, logger }
 */
async function handleQuestion({ chatId, text, deps }) {
  const { send, ask, state, rateLimiter, config, logger = console } = deps;

  // 1) Rate limit
  const rl = rateLimiter.check(chatId);
  if (!rl.allowed) {
    await send.sendMessage(
      chatId,
      `Biroz sekinroq 🙂 ${rl.retryAfterSec} soniyadan so'ng yana urinib ko'ring.`
    );
    return;
  }

  // 2) Statistika + tarixga qo'shish
  state.track(chatId);
  state.addUserMessage(chatId, text);

  // 3) "Yozyapti..." holati
  try {
    await send.sendChatAction(chatId, 'typing');
  } catch (_) {
    /* muhim emas */
  }

  // 4) Gemini'dan javob
  try {
    const history = state.getHistory(chatId);
    const answer = await ask(history);
    state.addModelMessage(chatId, answer);
    await sendLong(send, chatId, answer);
  } catch (err) {
    logger.error('[gemini] xato:', err && err.message ? err.message : err);
    // Muvaffaqiyatsiz savolni tarixdan olib tashlaymiz (kontekst buzilmasligi uchun)
    const h = state.getHistory(chatId);
    if (h.length && h[h.length - 1].role === 'user') h.pop();
    await send.sendMessage(
      chatId,
      "Kechirasiz, hozir javob olishda muammo bo'ldi. Birozdan so'ng qayta urinib ko'ring."
    );
  }
}

module.exports = {
  splitMessage,
  sendLong,
  handleStart,
  handleHelp,
  handleReset,
  handleStats,
  handleQuestion,
  WELCOME,
  HELP,
};
