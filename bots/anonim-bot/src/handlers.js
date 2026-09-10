'use strict';
const fs = require('fs');
const path = require('path');
const { state, persist, trimThreads, ensureUser } = require('./state');
const util = require('./util');
const checks = require('./checks');
const admin = require('./admin');

const WELCOME_IMG = path.join(__dirname, '..', 'assets', 'welcome.png');

// Anonim xabar yetkazish. Agar admin ishtirok etsa (sender yoki target ADMIN_ID bo'lsa),
// "💬 Admin javobi" / "💬 Foydalanuvchidan xabar" sarlavhasi ishlatiladi va tugmalar olib tashlanadi.
async function deliverAnonymous(bot, targetId, msg, senderId, replyToInTarget = null) {
  const ADMIN_ID = process.env.ADMIN_ID || '';
  const fromAdmin = !!ADMIN_ID && String(senderId) === String(ADMIN_ID);
  const toAdmin   = !!ADMIN_ID && String(targetId) === String(ADMIN_ID);
  const involvesAdmin = fromAdmin || toAdmin;

  let header;
  if (fromAdmin) {
    header = "💬 *Admin javobi:*";
  } else if (toAdmin) {
    const u = state.users[String(senderId)] || {};
    const uname = u.username ? '@' + util.escMd(u.username) : '';
    header = `💬 *Foydalanuvchidan xabar*\nKim: ${util.safeName(u.name) || '—'} ${uname} (id: \`${senderId}\`)`;
  } else {
    header = "📨 Sizga yangi anonim xabar bor!";
  }

  const sourceMid = msg.message_id;
  const map = (mid) => { state.threads[`${targetId}:${mid}`] = { sender: senderId, sourceMid }; };

  const baseOpts = {};
  if (replyToInTarget) {
    baseOpts.reply_to_message_id = replyToInTarget;
    baseOpts.allow_sending_without_reply = true;
  }
  const kb = involvesAdmin ? {} : { reply_markup: util.anonActionKeyboard(senderId) };
  const md = involvesAdmin ? { parse_mode: 'Markdown' } : {};

  if (msg.text) {
    const sent = await bot.sendMessage(targetId, `${header}\n\n${msg.text}`, { ...baseOpts, ...kb, ...md });
    map(sent.message_id);
  } else {
    const head = await bot.sendMessage(targetId, header, { ...baseOpts, ...md });
    const copied = await bot.copyMessage(targetId, msg.chat.id, msg.message_id, { ...baseOpts, ...kb });
    map(head.message_id);
    map(copied.message_id);
  }
  trimThreads();
  persist.threads();
  state.stats.messages = (state.stats.messages || 0) + 1;
  persist.stats();
}

async function sendWelcome(bot, chatId, user) {
  const caption =
    "👋 *Assalomu alaykum!*\n\n" +
    "Bu — anonim savol-javob boti. Quyidagi shaxsiy havolangizni do'stlaringizga ulashing, " +
    "ular sizga *anonim* xabar yuborishadi.\n\n" + util.linkBlock(user);
  const opts = { parse_mode: 'Markdown', reply_markup: util.shareKeyboard(user.code) };
  if (fs.existsSync(WELCOME_IMG)) {
    try { await bot.sendPhoto(chatId, WELCOME_IMG, { caption, ...opts }); return; }
    catch (e) { /* matnga o'tamiz */ }
  }
  await bot.sendMessage(chatId, caption, opts);
}

// /start (referralsiz yoki referral bilan)
async function handleStart(bot, msg, payload) {
  const chatId = msg.chat.id;
  const me = ensureUser(msg.from);
  const senderId = String(msg.from.id);

  if (checks.isBanned(senderId)) {
    return bot.sendMessage(chatId, "⛔️ Siz botdan foydalanishdan cheklangansiz.");
  }
  const sub = await checks.checkChannels(bot, senderId);
  if (!sub.ok) {
    return bot.sendMessage(chatId,
      "📺 Botdan foydalanish uchun quyidagi kanal(lar)ga obuna bo'ling:",
      { reply_markup: util.channelSubKeyboard(sub.missing) });
  }

  if (!payload) {
    delete state.sessions[senderId]; persist.sessions();
    return sendWelcome(bot, chatId, me);
  }
  const targetId = state.codes[payload];
  if (!targetId) {
    await bot.sendMessage(chatId, "❌ Havola noto'g'ri yoki eskirgan.");
    return sendWelcome(bot, chatId, me);
  }
  if (targetId === senderId) {
    await bot.sendMessage(chatId, "🙂 O'zingizga anonim xabar yubora olmaysiz.");
    return sendWelcome(bot, chatId, me);
  }
  if (checks.isBlocked(targetId, senderId)) {
    return bot.sendMessage(chatId, "🚫 Sizni bu foydalanuvchi bloklagan.");
  }
  state.sessions[senderId] = targetId;
  persist.sessions();

  // Maxsus salomlashuv (agar A o'rnatgan bo'lsa)
  const target = state.users[targetId];
  const greet = (target && target.welcome) ? target.welcome : "✍️ Murojaatingizni shu yerga yozing!";
  await bot.sendMessage(chatId, greet);
}

// /welcome — maxsus salomlashuv matni
async function handleSetWelcome(bot, msg, text) {
  const chatId = msg.chat.id;
  const me = ensureUser(msg.from);
  const id = String(msg.from.id);

  if (!text || !text.trim()) {
    const lines = [
      "💬 *Maxsus salomlashuv matni*",
      "",
      "Sizning shaxsiy havolangiz orqali kirgan odamlar standart matn (\"✍️ Murojaatingizni shu yerga yozing!\") o'rniga sizning matningizni ko'radi.",
      "",
      "*Misol:*",
      "`/welcome Salom! Men Abdulmajid. Menga istalgan savol bering 🙂`",
      "",
      "Bu yozsangiz — sizning referral havolangizga kirgan har bir odam aynan shu matnni ko'radi va keyin xabarini yozadi.",
      "",
      "Tozalash (standartga qaytish): `/welcome -`",
    ];
    await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
    if (me.welcome) {
      await bot.sendMessage(chatId, "Hozirgi matningiz:");
      await bot.sendMessage(chatId, me.welcome);
    } else {
      await bot.sendMessage(chatId, "ℹ️ Hozir standart matn ishlatilmoqda.");
    }
    return;
  }
  if (text.trim() === '-') {
    delete state.users[id].welcome;
    persist.users();
    return bot.sendMessage(chatId, "✅ Salomlashuv matni standartga qaytarildi.");
  }
  state.users[id].welcome = text.trim().slice(0, 500);
  persist.users();
  await bot.sendMessage(chatId, "✅ Salomlashuv matni saqlandi:");
  await bot.sendMessage(chatId, state.users[id].welcome);
}

// /blocks — bloklanganlar ro'yxati
async function handleBlocks(bot, msg) {
  const id = String(msg.from.id);
  ensureUser(msg.from);
  const list = state.blocks[id] || [];
  if (!list.length) {
    return bot.sendMessage(msg.chat.id, "🔓 Bloklangan foydalanuvchilar yo'q.");
  }
  const rows = list.slice(0, 20).map((sid, i) => [
    { text: `🔓 #${i + 1} ni ochish`, callback_data: `ub:${sid}` },
  ]);
  await bot.sendMessage(msg.chat.id,
    `🚫 *Bloklanganlar* (${list.length} ta)\n\nIstalgan birini tugma orqali ochishingiz mumkin.`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } });
}

// /admin — admin bilan bog'lanish (foydalanuvchi uchun)
async function handleAdminContact(bot, msg) {
  const id = String(msg.from.id);
  ensureUser(msg.from);
  if (checks.isBanned(id)) {
    return bot.sendMessage(msg.chat.id, "⛔️ Siz botdan foydalanishdan cheklangansiz.");
  }
  if (admin.isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, "🛠 Admin paneli uchun /anoner buyrug'idan foydalaning.");
  }
  if (!process.env.ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, "⚠️ Admin sozlanmagan.");
  }
  delete state.sessions[id]; persist.sessions();
  state.adminContact.set(id, true);
  await bot.sendMessage(msg.chat.id,
    "💬 Admin bilan bog'lanmoqdasiz.\n\nXabaringizni shu yerga yozing — bevosita adminga yetkaziladi.");
}

// Asosiy xabar handler
async function handleMessage(bot, msg) {
  const from = msg.from;
  if (!from || from.is_bot) return;
  if (msg.chat.type !== 'private') return;
  if (msg.text && msg.text.startsWith('/')) return;

  const senderId = String(from.id);
  ensureUser(from);
  const chatId = msg.chat.id;

  if (checks.isBanned(senderId)) {
    return bot.sendMessage(chatId, "⛔️ Siz botdan foydalanishdan cheklangansiz.");
  }

  // Admin holatlari (broadcast, kanal qo'shish)
  if (admin.isAwaitingBroadcast(senderId)) {
    return admin.handleBroadcastInput(bot, msg);
  }
  if (admin.isAwaitingChannel(senderId)) {
    return admin.handleChannelInput(bot, msg);
  }

  // Admin bilan bog'lanish holati
  if (state.adminContact.get(senderId)) {
    const ADMIN_ID = process.env.ADMIN_ID;
    if (!ADMIN_ID) {
      state.adminContact.delete(senderId);
      return bot.sendMessage(chatId, "⚠️ Admin sozlanmagan.");
    }
    const rl = checks.checkRateLimit(senderId);
    if (!rl.ok) {
      return bot.sendMessage(chatId,
        `⏳ Juda ko'p xabar! ${rl.scope === 'minute' ? 'Bir daqiqa' : 'Bir soat'} kutib turing.`);
    }
    try {
      await deliverAnonymous(bot, ADMIN_ID, msg, senderId, null);
      await bot.sendMessage(chatId, "✅ Xabaringiz adminga yetkazildi! Admin javob qaytarganda shu yerga keladi.");
    } catch (e) {
      await bot.sendMessage(chatId, "❌ Xabar yetkazilmadi.");
    }
    state.adminContact.delete(senderId);
    return;
  }

  // Kanal obunasi (admin bo'lmaganlarga)
  if (!admin.isAdmin(senderId)) {
    const sub = await checks.checkChannels(bot, senderId);
    if (!sub.ok) {
      return bot.sendMessage(chatId,
        "📺 Botdan foydalanish uchun quyidagi kanal(lar)ga obuna bo'ling:",
        { reply_markup: util.channelSubKeyboard(sub.missing) });
    }
  }

  // 1) REPLY: kelgan anonim xabarga reply qilingan
  if (msg.reply_to_message) {
    const key = `${chatId}:${msg.reply_to_message.message_id}`;
    const thread = state.threads[key];
    if (thread) {
      // backward-compat: eski format string edi
      const originalSender = typeof thread === 'string' ? thread : thread.sender;
      const replyToInOrig = typeof thread === 'object' ? thread.sourceMid : null;

      if (checks.isBlocked(originalSender, senderId)) {
        return bot.sendMessage(chatId, "🚫 Bu foydalanuvchi sizni bloklagan.");
      }
      const rl = checks.checkRateLimit(senderId);
      if (!rl.ok) {
        return bot.sendMessage(chatId,
          `⏳ Juda ko'p xabar! ${rl.scope === 'minute' ? 'Bir daqiqa' : 'Bir soat'} kutib turing.`);
      }
      try {
        await deliverAnonymous(bot, originalSender, msg, senderId, replyToInOrig);
        await bot.sendMessage(chatId, "✅ Javobingiz yuborildi!");
      } catch (e) {
        await bot.sendMessage(chatId, "❌ Xabar yetkazilmadi (foydalanuvchi botni bloklagan bo'lishi mumkin).");
      }
      return;
    }
  }

  // 2) FAOL SESSIYA (referral orqali kirgan birinchi xabar)
  const targetId = state.sessions[senderId];
  if (targetId) {
    if (checks.isBlocked(targetId, senderId)) {
      delete state.sessions[senderId]; persist.sessions();
      return bot.sendMessage(chatId, "🚫 Sizni bu foydalanuvchi bloklagan.");
    }
    const rl = checks.checkRateLimit(senderId);
    if (!rl.ok) {
      return bot.sendMessage(chatId,
        `⏳ Juda ko'p xabar! ${rl.scope === 'minute' ? 'Bir daqiqa' : 'Bir soat'} kutib turing.`);
    }
    try {
      await deliverAnonymous(bot, targetId, msg, senderId, null);
      await bot.sendMessage(chatId, "✅ Xabaringiz yuborildi!");
    } catch (e) {
      await bot.sendMessage(chatId, "❌ Xabar yetkazilmadi (foydalanuvchi botni bloklagan bo'lishi mumkin).");
      return;
    }
    delete state.sessions[senderId]; persist.sessions();
    await bot.sendMessage(chatId, util.linkBlock(state.users[senderId]), {
      parse_mode: 'Markdown',
      reply_markup: util.shareKeyboard(state.users[senderId].code),
    });
    return;
  }

  // 3) Sessiya ham, reply ham yo'q
  await bot.sendMessage(chatId,
    "ℹ️ Anonim xabar yuborish uchun avval kimningdir havolasiga kiring.\n\n" +
    "O'zingizning havolangiz orqali esa sizga xabar yuborishadi 👇");
  await bot.sendMessage(chatId, util.linkBlock(state.users[senderId]), {
    parse_mode: 'Markdown',
    reply_markup: util.shareKeyboard(state.users[senderId].code),
  });
}

// Callback query (tugmalar)
async function handleCallback(bot, query) {
  const data = query.data || '';
  const fromId = String(query.from.id);
  const chatId = query.message && query.message.chat.id;
  const msgId = query.message && query.message.message_id;
  ensureUser(query.from);

  try {
    if (data.startsWith('b:')) {
      const senderId = data.slice(2);
      if (!state.blocks[fromId]) state.blocks[fromId] = [];
      if (!state.blocks[fromId].includes(senderId)) {
        state.blocks[fromId].push(senderId);
        persist.blocks();
      }
      return bot.answerCallbackQuery(query.id, { text: "🚫 Bloklandi" });
    }
    if (data.startsWith('ub:')) {
      const senderId = data.slice(3);
      state.blocks[fromId] = (state.blocks[fromId] || []).filter((s) => s !== senderId);
      persist.blocks();
      await bot.answerCallbackQuery(query.id, { text: "🔓 Bloki ochildi" });
      try { await bot.editMessageText(`✅ Foydalanuvchi ochildi.`, { chat_id: chatId, message_id: msgId }); } catch {}
      return;
    }
    if (data.startsWith('r:')) {
      const senderId = data.slice(2);
      const ok = await admin.handleReport(bot, fromId, senderId, chatId, msgId);
      return bot.answerCallbackQuery(query.id, {
        text: ok ? "🚩 Shikoyat yuborildi" : "🚩 Qabul qilindi",
      });
    }
    if (data === 'chk') {
      const sub = await checks.checkChannels(bot, fromId);
      if (sub.ok) {
        await bot.answerCallbackQuery(query.id, { text: "✅ Obuna tasdiqlandi!" });
        try { await bot.deleteMessage(chatId, msgId); } catch {}
        await sendWelcome(bot, chatId, state.users[fromId]);
      } else {
        await bot.answerCallbackQuery(query.id, { text: "❌ Hali obuna bo'lmagansiz", show_alert: true });
      }
      return;
    }
    if (data.startsWith('a:') || data.startsWith('gban:') || data.startsWith('gbl:') || data.startsWith('gunban:') || data.startsWith('chrm:')) {
      return admin.handleAdminCallback(bot, query);
    }
    return bot.answerCallbackQuery(query.id);
  } catch (e) {
    console.error('callback error:', e.message);
    try { await bot.answerCallbackQuery(query.id, { text: "❌ Xatolik" }); } catch {}
  }
}

// Kanalda foydalanuvchi obunasi o'zgarganda (bot kanalda admin bo'lsa keladi)
async function handleChatMember(bot, update) {
  if (!update || !update.chat || !update.new_chat_member) return;
  const chat = update.chat;
  const user = update.new_chat_member.user;
  const oldS = update.old_chat_member && update.old_chat_member.status;
  const newS = update.new_chat_member.status;
  if (!user || user.is_bot) return;

  // Faqat bizning majburiy kanallarimizdagi o'zgarishlar
  const ch = state.channels.find((c) =>
    (c.id && String(c.id) === String(chat.id)) ||
    (c.username && chat.username && c.username.toLowerCase() === chat.username.toLowerCase())
  );
  if (!ch) return;

  const isMem = (s) => ['member', 'administrator', 'creator', 'restricted'].includes(s);
  const wasMember = isMem(oldS);
  const isNowMember = isMem(newS);

  if (!wasMember && isNowMember) {
    await admin.notifyChannelJoin(bot, ch, user);
  } else if (wasMember && !isNowMember) {
    await admin.notifyChannelLeave(bot, ch, user);
  }
}

// Botning o'zining statusi kanal/guruh/private chatda o'zgarsa
async function handleMyChatMember(bot, update) {
  if (!update || !update.chat) return;
  const oldS = update.old_chat_member && update.old_chat_member.status;
  const newS = update.new_chat_member && update.new_chat_member.status;
  await admin.notifyBotStatusChange(bot, update.chat, oldS, newS, update.from);
}

function registerHandlers(bot) {
  bot.onText(/^\/start(?:\s+(\S+))?$/, async (msg, m) => {
    try { await handleStart(bot, msg, m && m[1]); } catch (e) { console.error('start:', e.message); }
  });
  bot.onText(/^\/welcome(?:\s+([\s\S]+))?$/, async (msg, m) => {
    try { await handleSetWelcome(bot, msg, m && m[1]); } catch (e) { console.error('welcome:', e.message); }
  });
  bot.onText(/^\/blocks$/, async (msg) => {
    try { await handleBlocks(bot, msg); } catch (e) { console.error('blocks:', e.message); }
  });
  bot.onText(/^\/admin$/, async (msg) => {
    try { await handleAdminContact(bot, msg); } catch (e) { console.error('admin:', e.message); }
  });
  bot.onText(/^\/anoner$/, async (msg) => {
    try { await admin.handleAnonerCommand(bot, msg); } catch (e) { console.error('anoner:', e.message); }
  });
  bot.on('message', async (msg) => {
    try { await handleMessage(bot, msg); } catch (e) { console.error('message:', e.message); }
  });
  bot.on('callback_query', async (q) => {
    try { await handleCallback(bot, q); } catch (e) { console.error('callback:', e.message); }
  });
  bot.on('chat_member', async (u) => {
    try { await handleChatMember(bot, u); } catch (e) { console.error('chat_member:', e.message); }
  });
  bot.on('my_chat_member', async (u) => {
    try { await handleMyChatMember(bot, u); } catch (e) { console.error('my_chat_member:', e.message); }
  });
  bot.on('polling_error', (e) => console.error('polling_error:', e.code || e.message));
}

module.exports = {
  registerHandlers, deliverAnonymous, sendWelcome,
  handleStart, handleMessage, handleCallback,
  handleSetWelcome, handleBlocks, handleAdminContact,
  handleChatMember, handleMyChatMember,
};
