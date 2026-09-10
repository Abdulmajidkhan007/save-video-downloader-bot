// ============================================================
//  Barcha hodisalarni (handler) ulash:
//  ro'yxat, obuna, menyu, yakka test, guruh testlari, admin panel, statistika.
// ============================================================
const { COUNT_OPTIONS, TIME_OPTIONS } = require('../config');
const fs = require('fs');
const path = require('path');
const storage = require('./storage');
const questions = require('./questions');
const quiz = require('./quiz');
const groupQuiz = require('./groupQuiz');
const admin = require('./admin');

const states = {}; // userId -> { step, phone }

// Botga kirgandagi tanishtiruv matni
const INTRO =
  "🎯 *Quiz Bot* — bilimingizni sinab ko'ring!\n\n" +
  "Bu bot bilan siz:\n" +
  "📚 IT yo'nalishlari bo'yicha test ishlaysiz (Frontend, Backend, Mobile va boshqalar)\n" +
  "⏱ Har savolga vaqt belgilangan — bilim va tezlik sinaladi\n" +
  "📊 Natija va statistikangiz saqlanadi\n" +
  "👥 Guruhda do'stlaringiz bilan reyting asosida musobaqalashasiz\n" +
  "🏆 Eng yuqori natija uchun kurashing!\n\n" +
  "Boshlash uchun ro'yxatdan o'ting 👇";

const WELCOME_IMG = path.join(__dirname, '..', 'assets', 'welcome.png');
const PHONE_KB = { keyboard: [[{ text: '📱 Raqamni yuborish', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };

// Tanishtiruvni (rasm bo'lsa rasm bilan) yuborish
function sendWelcome(bot, chatId) {
  if (fs.existsSync(WELCOME_IMG)) {
    bot.sendPhoto(chatId, WELCOME_IMG, { caption: INTRO, parse_mode: 'Markdown', reply_markup: PHONE_KB })
      .catch(() => bot.sendMessage(chatId, INTRO, { parse_mode: 'Markdown', reply_markup: PHONE_KB }));
  } else {
    bot.sendMessage(chatId, INTRO, { parse_mode: 'Markdown', reply_markup: PHONE_KB });
  }
}

// ---------------- Obuna ----------------
async function getNotSubscribed(bot, userId) {
  const missing = [];
  for (const ch of storage.getChannels()) {
    try {
      const m = await bot.getChatMember(ch, userId);
      if (m.status === 'left' || m.status === 'kicked') missing.push(ch);
    } catch { missing.push(ch); }
  }
  return missing;
}
async function requireSubscription(bot, chatId, userId) {
  const missing = await getNotSubscribed(bot, userId);
  if (!missing.length) return true;
  const rows = missing.map((ch, i) => [{ text: `📢 ${i + 1}-kanal`, url: `https://t.me/${ch.replace('@', '')}` }]);
  rows.push([{ text: '✅ Tekshirish', callback_data: 'checksub' }]);
  let t = "🔒 Davom etish uchun kanallarga obuna bo'ling:\n\n";
  missing.forEach((ch, i) => { t += `${i + 1}️⃣ ${ch}\n`; });
  bot.sendMessage(chatId, t, { reply_markup: { inline_keyboard: rows } });
  return false;
}

// ---------------- Menyu ----------------
function mainMenu(bot, chatId, name, userId) {
  const rows = [
    [{ text: '📝 Test ishlash' }],
    [{ text: '👥 Guruhda test' }],
    [{ text: '📊 Statistikam' }],
    [{ text: '➕ Savol qo\'shish' }, { text: '🆕 Yangi bo\'lim' }],
    [{ text: '📚 Yangi yo\'nalish' }]
  ];
  if (admin.isAdmin(userId)) rows.push([{ text: '🛠 Admin panel' }]);
  bot.sendMessage(chatId, `🎯 Asosiy menyu${name ? ', ' + name : ''}`, {
    reply_markup: { keyboard: rows, resize_keyboard: true }
  });
}

// ---------------- Kategoriya navigatsiyasi (yakka test) ----------------
function directionsKeyboard() {
  return questions.getDirections().map(d => [{ text: `${d.emoji} ${d.label}`, callback_data: `dir:${d.key}` }]);
}
function showDirections(bot, chatId) {
  const rows = directionsKeyboard();
  if (!rows.length) { bot.sendMessage(chatId, "⚠️ Hozircha kategoriya yo'q."); return; }
  bot.sendMessage(chatId, "🧭 Yo'nalishni tanlang:", { reply_markup: { inline_keyboard: rows } });
}
function editTo(bot, chatId, messageId, text, rows) {
  bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: rows } })
    .catch(() => bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: rows } }));
}
function showSubs(bot, chatId, messageId, dk) {
  const rows = questions.getSubs(dk).map(s => [{ text: `${s.label} (${s.count})`, callback_data: `sub:${dk}:${s.key}` }]);
  rows.push([{ text: '⬅️ Orqaga', callback_data: 'back:dirs' }]);
  editTo(bot, chatId, messageId, "📚 Bo'limni tanlang:", rows);
}
function showCounts(bot, chatId, messageId, dk, sk) {
  const rows = [COUNT_OPTIONS.map(c => ({ text: `${c} ta`, callback_data: `cnt:${dk}:${sk}:${c}` }))];
  rows.push([{ text: '⬅️ Orqaga', callback_data: `dir:${dk}` }]);
  editTo(bot, chatId, messageId, "🔢 Nechta savol?", rows);
}
function showTimes(bot, chatId, messageId, dk, sk, count) {
  const rows = [TIME_OPTIONS.map(t => ({ text: `${t}s`, callback_data: `tm:${dk}:${sk}:${count}:${t}` }))];
  rows.push([{ text: '⬅️ Orqaga', callback_data: `sub:${dk}:${sk}` }]);
  editTo(bot, chatId, messageId, "⏱ Har savolga necha soniya?", rows);
}

// ---------------- Statistika ----------------
function showStats(bot, chatId, userId) {
  const results = storage.getUserResults(userId);
  if (!results.length) { bot.sendMessage(chatId, "📊 Hali test ishlamadingiz."); return; }
  const total = results.length;
  const avg = Math.round(results.reduce((a, r) => a + r.pct, 0) / total);
  const best = Math.max(...results.map(r => r.pct));
  let t = `📊 Statistikangiz\n\n🧮 Jami testlar: ${total}\n📈 O'rtacha: ${avg}%\n🏆 Eng yaxshi: ${best}%\n\nSo'nggi 5 ta:\n`;
  results.slice(-5).reverse().forEach((r) => { t += `• ${r.label}: ${r.score}/${r.total} (${r.pct}%)\n`; });
  bot.sendMessage(chatId, t);
}

// ---------------- Amallar (ham tugma, ham buyruq uchun bir xil) ----------------
function ensureRegistered(bot, chatId, userId) {
  const user = storage.getUser(userId);
  if (!user || !user.name) { bot.sendMessage(chatId, "Avval /start bosib ro'yxatdan o'ting."); return null; }
  return user;
}
async function actTest(bot, chatId, userId) {
  if (!ensureRegistered(bot, chatId, userId)) return;
  if (quiz.hasActiveSession(userId)) { bot.sendMessage(chatId, '⏳ Sizda faol test bor — avval uni tugating.'); return; }
  if (!(await requireSubscription(bot, chatId, userId))) return;
  showDirections(bot, chatId);
}
async function actGroup(bot, chatId, userId) {
  if (!ensureRegistered(bot, chatId, userId)) return;
  if (!(await requireSubscription(bot, chatId, userId))) return;
  groupQuiz.startHosting(bot, chatId, userId);
}
function actStats(bot, chatId, userId) {
  if (!ensureRegistered(bot, chatId, userId)) return;
  showStats(bot, chatId, userId);
}
function actMenu(bot, chatId, userId) {
  const user = ensureRegistered(bot, chatId, userId);
  if (user) mainMenu(bot, chatId, user.name, userId);
}
// Hamma uchun: savol qo'shish va yangi bo'lim
async function actAddQuestion(bot, chatId, userId) {
  if (!ensureRegistered(bot, chatId, userId)) return;
  if (!(await requireSubscription(bot, chatId, userId))) return;
  admin.startAdd(bot, chatId);
}
async function actNewSection(bot, chatId, userId) {
  if (!ensureRegistered(bot, chatId, userId)) return;
  if (!(await requireSubscription(bot, chatId, userId))) return;
  admin.startNewSub(bot, chatId);
}
async function actNewDirection(bot, chatId, userId) {
  if (!ensureRegistered(bot, chatId, userId)) return;
  if (!(await requireSubscription(bot, chatId, userId))) return;
  admin.startNewDir(bot, chatId, userId);
}

// ---------------- Ulash ----------------
function register(bot) {
  // ----- Buyruqlar (tugmalar bilan bir xil ishlaydi) -----
  const priv = (fn) => (msg) => { if (msg.chat.type === 'private') fn(msg); };

  bot.onText(/^\/id(?:@\w+)?$/, (msg) => bot.sendMessage(msg.chat.id, `🆔 Sizning ID: ${msg.from.id}`));
  bot.onText(/^\/menu(?:@\w+)?$/, priv((msg) => actMenu(bot, msg.chat.id, msg.from.id)));
  bot.onText(/^\/test(?:@\w+)?$/, priv((msg) => actTest(bot, msg.chat.id, msg.from.id)));
  bot.onText(/^\/group(?:@\w+)?$/, priv((msg) => actGroup(bot, msg.chat.id, msg.from.id)));
  bot.onText(/^\/stats(?:@\w+)?$/, priv((msg) => actStats(bot, msg.chat.id, msg.from.id)));
  bot.onText(/^\/qush(?:@\w+)?$/, priv((msg) => actAddQuestion(bot, msg.chat.id, msg.from.id)));
  bot.onText(/^\/bolim(?:@\w+)?$/, priv((msg) => actNewSection(bot, msg.chat.id, msg.from.id)));
  bot.onText(/^\/yunalish(?:@\w+)?$/, priv((msg) => actNewDirection(bot, msg.chat.id, msg.from.id)));
  bot.onText(/^\/admin(?:@\w+)?$/, priv((msg) => admin.openPanel(bot, msg.chat.id, msg.from.id)));
  bot.onText(/^\/adminpanel(?:@\w+)?$/, priv((msg) => admin.openPanel(bot, msg.chat.id, msg.from.id)));

  // Buyruqlar ro'yxatini Telegram "/" menyusiga qo'shamiz
  bot.setMyCommands([
    { command: 'start', description: "Boshlash / ro'yxatdan o'tish" },
    { command: 'menu', description: 'Asosiy menyu' },
    { command: 'test', description: 'Yakka test ishlash' },
    { command: 'group', description: "Guruhda test o'tkazish" },
    { command: 'stats', description: 'Statistikam' },
    { command: 'qush', description: "Savol qo'shish" },
    { command: 'bolim', description: "Yangi bo'lim yaratish" },
    { command: 'yunalish', description: "Yangi yo'nalish qo'shish" },
    { command: 'adminpanel', description: 'Admin panel' },
    { command: 'id', description: 'Mening ID raqamim' }
  ]).catch(() => {});

  bot.onText(/^\/start(?:@\w+)?$/, async (msg) => {
    if (msg.chat.type !== 'private') return;
    const chatId = msg.chat.id, userId = msg.from.id;
    const user = storage.getUser(userId);
    if (user && user.name) {
      if (await requireSubscription(bot, chatId, userId)) mainMenu(bot, chatId, user.name, userId);
      return;
    }
    states[userId] = { step: 'phone' };
    sendWelcome(bot, chatId);
  });

  bot.on('contact', (msg) => {
    if (msg.chat.type !== 'private') return;
    const chatId = msg.chat.id, userId = msg.from.id;
    const st = states[userId];
    if (!st || st.step !== 'phone') return;
    if (msg.contact.user_id !== userId) { bot.sendMessage(chatId, "⚠️ Faqat o'z raqamingizni yuboring."); return; }
    states[userId] = { step: 'name', phone: msg.contact.phone_number };
    bot.sendMessage(chatId, '👤 Ism va familiyangizni kiriting:', { reply_markup: { remove_keyboard: true } });
  });

  bot.on('message', async (msg) => {
    if (msg.chat.type !== 'private') return;
    // Admin kiritish bosqichlari (savol matni, variantlar, bo'lim nomi)
    if (admin.handleMessage(bot, msg)) return;

    const chatId = msg.chat.id, userId = msg.from.id, text = msg.text;
    if (!text || text.startsWith('/') || msg.contact) return;
    const st = states[userId];

    if (st && st.step === 'name') {
      const user = storage.upsertUser({ id: userId, name: text.trim(), phone: st.phone, registeredAt: new Date().toISOString() });
      delete states[userId];
      bot.sendMessage(chatId, `✅ Ro'yxatdan o'tdingiz!\n👤 ${user.name}\n📞 ${user.phone}`);
      if (await requireSubscription(bot, chatId, userId)) mainMenu(bot, chatId, user.name, userId);
      return;
    }
    if (st && st.step === 'phone') { bot.sendMessage(chatId, '👇 Pastdagi tugma orqali raqamingizni yuboring.'); return; }

    const user = storage.getUser(userId);
    if (!user || !user.name) { bot.sendMessage(chatId, "/start bosib ro'yxatdan o'ting."); return; }

    if (text === '📝 Test ishlash') { await actTest(bot, chatId, userId); return; }
    if (text === '👥 Guruhda test') { await actGroup(bot, chatId, userId); return; }
    if (text === '📊 Statistikam') { actStats(bot, chatId, userId); return; }
    if (text === '➕ Savol qo\'shish') { await actAddQuestion(bot, chatId, userId); return; }
    if (text === '🆕 Yangi bo\'lim') { await actNewSection(bot, chatId, userId); return; }
    if (text === '📚 Yangi yo\'nalish') { await actNewDirection(bot, chatId, userId); return; }
    if (text === '🛠 Admin panel') { admin.openPanel(bot, chatId, userId); return; }
  });

  bot.on('callback_query', async (query) => {
    try {
      // Avval admin callbacklari (a:*)
      if (await admin.handleCallback(bot, query)) return;
      // So'ng guruh callbacklari (g*)
      if (await groupQuiz.handleCallback(bot, query)) return;

      const chatId = query.message.chat.id;
      const userId = query.from.id;
      const messageId = query.message.message_id;
      const data = query.data || '';

      if (data === 'checksub') {
        const missing = await getNotSubscribed(bot, userId);
        if (missing.length) {
          await bot.answerCallbackQuery(query.id, { text: "❌ Hali obuna bo'lmadingiz!", show_alert: true });
        } else {
          await bot.answerCallbackQuery(query.id, { text: '✅ Tasdiqlandi!' });
          bot.deleteMessage(chatId, messageId).catch(() => {});
          const user = storage.getUser(userId);
          mainMenu(bot, chatId, user && user.name, userId);
        }
        return;
      }
      if (data === 'back:dirs') {
        await bot.answerCallbackQuery(query.id);
        editTo(bot, chatId, messageId, "🧭 Yo'nalishni tanlang:", directionsKeyboard());
        return;
      }

      const p = data.split(':');
      if (p[0] === 'dir') { await bot.answerCallbackQuery(query.id); showSubs(bot, chatId, messageId, p[1]); return; }
      if (p[0] === 'sub') { await bot.answerCallbackQuery(query.id); showCounts(bot, chatId, messageId, p[1], p[2]); return; }
      if (p[0] === 'cnt') { await bot.answerCallbackQuery(query.id); showTimes(bot, chatId, messageId, p[1], p[2], parseInt(p[3], 10)); return; }
      if (p[0] === 'tm') {
        await bot.answerCallbackQuery(query.id, { text: '🚀 Boshlandi!' });
        bot.deleteMessage(chatId, messageId).catch(() => {});
        if (!(await requireSubscription(bot, chatId, userId))) return;
        quiz.startQuiz(bot, chatId, userId, p[1], p[2], parseInt(p[3], 10), parseInt(p[4], 10));
        return;
      }
    } catch (e) {
      console.error('callback xato:', e.message);
    }
  });

  bot.on('my_chat_member', (update) => groupQuiz.handleMyChatMember(bot, update));

  bot.on('poll_answer', (pollAnswer) => {
    quiz.handleAnswer(bot, pollAnswer);
    groupQuiz.handleAnswer(bot, pollAnswer);
  });
}

module.exports = { register };
