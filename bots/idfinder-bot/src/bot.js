'use strict';

const TelegramBot = require('node-telegram-bot-api');

const { BOT_TOKEN, ADMIN_IDS, isAdmin } = require('./config');
const storage = require('./utils/storage');
const keyboards = require('./utils/keyboards');
const state = require('./utils/state');
const botInfo = require('./utils/botInfo');

const start = require('./handlers/start');
const search = require('./handlers/search');
const getId = require('./handlers/getId');
const admin = require('./handlers/admin');
const inline = require('./handlers/inline');

const HELP_TEXT =
  '❓ <b>Yordam</b>\n\n' +
  '<b>Komandalar:</b>\n' +
  '/search — 🔍 Foydalanuvchini ID, username yoki telefon orqali qidirish\n' +
  '/getid — 🆔 Kanal, guruh yoki foydalanuvchi ID sini olish\n' +
  '/myid — 👤 Sizning Telegram ID ingizni ko\'rsatish\n' +
  '/start — Botni qayta ishga tushirish\n\n' +
  '<b>Qo\'shimcha:</b>\n' +
  '• Kanal yoki guruhdan xabar <b>forward</b> qilib yuboring — bot ID ni avtomatik qaytaradi.\n' +
  '• <b>Inline</b>: istalgan chatda <code>@bot_username @durov</code> deb yozing — ID chiqadi.\n' +
  '• /cancel — joriy amalni bekor qilish';

// Runtime data tayyorlash (seed ko'chirish).
storage.init();

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ---- setMyCommands (bir marta startup'da) ----
async function registerCommands() {
  const publicCmds = [
    { command: 'start', description: 'Botni ishga tushirish' },
    { command: 'search', description: 'Foydalanuvchini qidirish' },
    { command: 'getid', description: 'Kanal / Guruh / User ID olish' },
    { command: 'myid', description: "Mening ID'im" },
    { command: 'help', description: 'Yordam' },
  ];
  const adminCmds = [...publicCmds, { command: 'admin', description: 'Admin panel' }];

  try {
    await bot.setMyCommands(publicCmds);
    console.log('✅ setMyCommands (public) o\'rnatildi.');
  } catch (err) {
    console.error('⚠️  setMyCommands xatosi:', err.message);
  }

  for (const adminId of ADMIN_IDS) {
    try {
      await bot.setMyCommands(adminCmds, {
        scope: { type: 'chat', chat_id: adminId },
      });
    } catch (err) {
      console.error(`⚠️  Admin ${adminId} uchun commands:`, err.message);
    }
  }
}

// Bot username'ini olib saqlaymiz (add-to-group tugmasi, inline uchun).
async function loadBotInfo() {
  try {
    const me = await bot.getMe();
    botInfo.set(me);
    console.log(`🤖 @${me.username} ishga tushdi (polling).`);
  } catch (err) {
    console.error('⚠️  getMe xatosi:', err.message);
    console.log('🤖 ID Topuvchi Bot ishga tushdi (polling).');
  }
}

registerCommands();
loadBotInfo();

// ---- Obuna gate (admin bypass) ----
async function gate(chatId, userId) {
  if (isAdmin(userId)) return true;
  return start.ensureSubscribed(bot, chatId, userId);
}

// Birinchi so'zni komanda sifatida ajratadi va @botname / parametrni tashlaydi:
// "/start@botname from_inline" → "/start"
function parseCmd(text) {
  return (text || '').trim().split(/\s+/)[0].split('@')[0].toLowerCase();
}

// =================== CALLBACK QUERY ROUTING ===================
bot.on('callback_query', async (query) => {
  const data = query.data || '';
  const chatId = query.message.chat.id;
  const userId = query.from.id;

  try {
    // Obunadan oldin ishlaydiganlar.
    if (data === 'sub:check') return start.handleSubCheck(bot, query);

    // Admin bo'limi.
    if (data.startsWith('admin:')) {
      if (data === 'admin:menu') return admin.showAdminMenu(bot, query);
      if (data === 'admin:stats') return admin.showStats(bot, query);
      if (data === 'admin:channels') return admin.showChannels(bot, query);
      if (data === 'admin:chan_add') return admin.promptAddChannel(bot, query);
      if (data.startsWith('admin:chan_del:')) {
        return admin.deleteChannel(bot, query, data.slice('admin:chan_del:'.length));
      }
      if (data === 'admin:broadcast') return admin.promptBroadcast(bot, query);
      if (data === 'admin:users') return admin.showUsers(bot, query);
      return bot.answerCallbackQuery(query.id);
    }

    // Qolgan amallar uchun obuna tekshiruvi.
    if (!(await gate(chatId, userId))) {
      return bot.answerCallbackQuery(query.id, {
        text: "Avval kanal(lar)ga a'zo bo'ling.",
        show_alert: true,
      });
    }

    // /search inline tugmalari.
    if (data === 'search:menu') return search.showSearchMenu(bot, query);
    if (data === 'search:by_id') return search.promptById(bot, query);
    if (data === 'search:by_username') return search.promptByUsername(bot, query);
    if (data === 'search:by_phone') return search.promptByPhone(bot, query);

    return bot.answerCallbackQuery(query.id);
  } catch (err) {
    console.error('❌ callback_query xatosi:', err.message);
    try {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ Xatolik yuz berdi.' });
    } catch (_) { /* ignore */ }
  }
});

// =================== MESSAGE ROUTING ===================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from && msg.from.id;
  if (!userId) return;

  try {
    const text = (msg.text || '').trim();
    const cmd = parseCmd(text);

    // ---- /cancel (holat tozalash, obunasiz ishlaydi) ----
    if (cmd === '/cancel') {
      state.clear(userId);
      await bot.sendMessage(chatId, '✖️ Bekor qilindi.', keyboards.removeKeyboard());
      return;
    }

    // "❌ Bekor qilish" reply tugmasi.
    if (text === '❌ Bekor qilish') {
      state.clear(userId);
      await bot.sendMessage(chatId, '✖️ Bekor qilindi.', keyboards.removeKeyboard());
      return;
    }

    // ---- /start (obuna gate ichida) ----
    if (cmd === '/start') return start.handleStart(bot, msg);

    // ---- Admin state kiritishi — gate'dan oldin (admin bypass) ----
    if (await admin.handleAdminInput(bot, msg)) return;

    // ---- request_chat / request_users javoblari ----
    if (msg.chat_shared) {
      if (!(await gate(chatId, userId))) return;
      return getId.handleChatShared(bot, msg);
    }
    if (msg.users_shared) {
      if (!(await gate(chatId, userId))) return;
      return getId.handleUsersShared(bot, msg);
    }

    // ---- Kontakt ulashish ----
    if (msg.contact) {
      if (!(await gate(chatId, userId))) return;
      return search.handleContact(bot, msg);
    }

    // Bu yerdan pastdagi barcha amallar uchun obuna talab qilinadi.
    if (!(await gate(chatId, userId))) return;

    // ---- Slash komandalar ----
    if (cmd === '/search') {
      return bot.sendMessage(chatId, '🔍 <b>Foydalanuvchini qidirish</b>\n\nUsulni tanlang:', {
        parse_mode: 'HTML',
        ...keyboards.searchMenu(),
      });
    }

    if (cmd === '/getid') return getId.handleGetIdCommand(bot, chatId);

    if (cmd === '/myid') {
      const u = msg.from;
      return bot.sendMessage(
        chatId,
        '👤 <b>Sizning ma\'lumotlaringiz</b>\n\n' +
          `🆔 ID: <code>${u.id}</code>\n` +
          (u.username ? `📛 Username: @${u.username}\n` : '') +
          (u.first_name ? `👤 Ism: ${u.first_name}\n` : '') +
          (u.last_name ? `👥 Familiya: ${u.last_name}\n` : ''),
        { parse_mode: 'HTML' }
      );
    }

    if (cmd === '/help') {
      return bot.sendMessage(chatId, HELP_TEXT, { parse_mode: 'HTML' });
    }

    if (cmd === '/admin') {
      if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '⛔ Sizda admin huquqi yo\'q.');
      }
      return bot.sendMessage(chatId, '🛠 <b>Admin panel</b>\n\nBo\'limni tanlang:', {
        parse_mode: 'HTML',
        ...keyboards.adminMenu(),
      });
    }

    // ---- Forward orqali ID olish ----
    if (msg.forward_date || msg.forward_from_chat || msg.forward_from) {
      if (await getId.handleForward(bot, msg)) return;
    }

    // ---- Qidiruv matnli kiritishi (state) ----
    if (await search.handleTextInput(bot, msg)) return;

    // ---- Fallback ----
    await bot.sendMessage(
      chatId,
      'ℹ️ Komanda tanlang yoki pastdagi <b>Menu</b> tugmasini bosing.',
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('❌ message xatosi:', err.message);
    try {
      await bot.sendMessage(chatId, "⚠️ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    } catch (_) { /* ignore */ }
  }
});

// =================== INLINE QUERY ===================
bot.on('inline_query', async (iq) => {
  try {
    await inline.handleInlineQuery(bot, iq);
  } catch (err) {
    console.error('❌ inline_query xatosi:', err.message);
  }
});

// =================== XATOLAR ===================
bot.on('polling_error', (err) => {
  console.error('⚠️ polling_error:', err.code || '', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ unhandledRejection:', reason);
});
