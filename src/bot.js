'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { config } = require('./config');
const storage = require('./services/storage');
const downloader = require('./services/downloader');
const urlcache = require('./services/urlcache');
const notify = require('./services/notify');

const start = require('./handlers/start');
const { handleStart, handleHelp, handleUserStats } = start;
const download = require('./handlers/download');
const admin = require('./handlers/admin');
const { checkSubscription, sendSubscriptionPrompt } = require('./handlers/subscription');

// ---- Boshlang'ich tekshiruvlar ------------------------------------------

if (!config.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN topilmadi. .env faylni to\'ldiring.');
  process.exit(1);
}

// Fayllar va papkalarni tayyorlaymiz
storage.init();
// Har restartda vaqtinchalik yuklamalar tozalanadi
downloader.cleanDownloadsDir();

// cookies.txt ni base64 env'dan tiklaymiz (Railway Variables bir qatorli).
function writeCookiesFromEnv() {
  if (!config.YTDLP_COOKIES_B64) return;
  try {
    const decoded = Buffer.from(config.YTDLP_COOKIES_B64, 'base64').toString('utf8');
    if (!fs.existsSync(config.DATA_DIR)) fs.mkdirSync(config.DATA_DIR, { recursive: true });
    fs.writeFileSync(config.YTDLP_COOKIES, decoded, 'utf8');
    console.log(`✅ cookies yuklandi: ${config.YTDLP_COOKIES}`);
  } catch (err) {
    console.error('[cookies] base64 dekod xato:', err.message);
  }
}
writeCookiesFromEnv();

// urlcache eski yozuvlarini vaqti-vaqti bilan tozalab turamiz.
setInterval(() => urlcache.cleanup(), 60 * 60 * 1000).unref();

// Diagnostika: yt-dlp qayerdaligini aniqlash uchun muhit ma'lumotlari.
function logYtDlpDiagnostics() {
  console.log('[diag] process.cwd():', process.cwd());
  console.log('[diag] YTDLP_PATH:', config.YTDLP_PATH);
  console.log('[diag] fs.existsSync(YTDLP_PATH):', fs.existsSync(config.YTDLP_PATH));
  const binDir = path.dirname(config.YTDLP_PATH);
  if (fs.existsSync(binDir)) {
    try {
      console.log(`[diag] readdirSync(${binDir}):`, fs.readdirSync(binDir));
    } catch (err) {
      console.log(`[diag] readdirSync(${binDir}) xato:`, err.message);
    }
  } else {
    console.log(`[diag] bin papka mavjud emas: ${binDir}`);
  }
}

// Binary'lar mavjud va ishlayotganini tekshiramiz (execFile — shell'siz).
function checkBinary(name, binPath, notifyOnFail) {
  execFile(binPath, ['--version'], { timeout: 15000 }, (err, stdout) => {
    if (err) {
      console.error(
        `❌ ${name} ishlamadi (${binPath}): ${err.message}\n` +
          '   Binary yo\'q yoki bajariladigan emas. Deploy loglarini tekshiring.'
      );
      if (notifyOnFail) {
        notify.notifyAdmins(
          `⚠️ <b>${name} ishlamayapti!</b>\n<code>${binPath}</code>\n${err.message}`
        );
      }
      return;
    }
    console.log(`✅ ${name} mavjud: v${String(stdout).trim().split('\n')[0]} (${binPath})`);
  });
}
logYtDlpDiagnostics();
checkBinary('yt-dlp', config.YTDLP_PATH, true);
checkBinary('gallery-dl', config.GALLERY_DL_PATH, false);

const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

// notify moduliga bot instansiyasini beramiz (admin xabarlari uchun).
notify.setBot(bot);

// ---- Slash-komandalar menyusi -------------------------------------------

async function setupCommands() {
  try {
    await bot.setMyCommands([
      { command: 'start', description: 'Botni ishga tushirish' },
      { command: 'stats', description: 'Shaxsiy statistikangiz' },
      { command: 'help', description: 'Yordam va platformalar' },
      { command: 'admin', description: 'Admin panel (faqat adminlar)' },
    ]);
  } catch (err) {
    console.error('[bot] setMyCommands xato:', err.message);
  }
}

// ---- Bot ma'lumotlari ----------------------------------------------------

bot
  .getMe()
  .then((me) => {
    download.setBotUsername(me.username);
    start.setBotUsername(me.username);
    console.log(`✅ Bot ishga tushdi: @${me.username}`);
  })
  .catch((err) => console.error('[bot] getMe xato:', err.message));

setupCommands();

// ---- Xatolarni ushlash (crash bo'lmasin) --------------------------------

bot.on('polling_error', (err) => {
  console.error('[polling_error]', err.code || '', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// ---- Buyruqlar -----------------------------------------------------------

bot.onText(/^\/start\b/, (msg) => {
  wrap(() => handleStart(bot, msg), msg);
});

bot.onText(/^\/help\b/, (msg) => {
  wrap(() => handleHelp(bot, msg), msg);
});

bot.onText(/^\/stats\b/, (msg) => {
  wrap(() => handleUserStats(bot, msg), msg);
});

bot.onText(/^\/admin\b/, (msg) => {
  wrap(() => admin.handleAdminCommand(bot, msg), msg);
});

// ---- Oddiy xabarlar ------------------------------------------------------

function isGroupChat(msg) {
  return msg.chat && (msg.chat.type === 'group' || msg.chat.type === 'supergroup');
}

bot.on('message', (msg) => {
  // Buyruqlarni bu yerda o'tkazib yuboramiz (onText allaqachon ushlagan)
  if (msg.text && /^\//.test(msg.text)) return;
  if (!msg.from) return;
  // Xizmat xabarlari (a'zo qo'shildi/chiqdi va h.k.) — e'tibor bermaymiz
  if (msg.new_chat_members || msg.left_chat_member || msg.group_chat_created) return;

  const group = isGroupChat(msg);

  wrap(
    async () => {
      // GURUH REJIMI: faqat qo'llab-quvvatlanadigan havolaga javob beramiz,
      // boshqa xabarlarga (matn/ovoz) aralashmaymiz, obuna tekshirmaymiz.
      if (group) {
        await download.handleUrlMessage(bot, msg, { isGroup: true });
        return;
      }

      // SHAXSIY CHAT: foydalanuvchini ro'yxatga qo'shamiz
      const user = storage.upsertUser(msg.from);
      if (user && user.isNew) {
        notify.notifyAdmins(
          '🆕 <b>Yangi foydalanuvchi</b>\n' +
            `👤 ${msg.from.first_name || ''} ${msg.from.username ? '@' + msg.from.username : ''}\n` +
            `🆔 <code>${msg.from.id}</code>\n` +
            `👥 Jami: ${storage.getUserCount()}`
        );
      }

      // Admin biror qadam kutayotgan bo'lsa — o'sha ushlaydi
      const handledByAdmin = await admin.handleAdminInput(bot, msg);
      if (handledByAdmin) return;

      // Ovozli/audio/video_note → musiqa aniqlash (Shazam kabi)
      if (msg.voice || msg.audio || msg.video_note) {
        await download.handleVoiceRecognition(bot, msg);
        return;
      }

      // Matn: avval URL sifatida, URL bo'lmasa — musiqa qidiruvi
      const handledAsUrl = await download.handleUrlMessage(bot, msg, { isGroup: false });
      if (handledAsUrl) return;

      if (msg.text && msg.text.trim()) {
        await download.handleTextSearch(bot, msg);
      }
    },
    msg,
    group
  );
});

// ---- Callback query'lar --------------------------------------------------

bot.on('callback_query', (query) => {
  const data = query.data || '';
  wrapCallback(async () => {
    if (data.startsWith('admin|')) {
      await admin.handleAdminCallback(bot, query);
      return;
    }
    if (data.startsWith('yt|')) {
      await download.handleYouTubeCallback(bot, query);
      return;
    }
    if (data.startsWith('mp3:')) {
      await download.handleMp3Callback(bot, query);
      return;
    }
    if (data.startsWith('song:')) {
      await download.handleSongCallback(bot, query);
      return;
    }
    if (data === 'check_sub') {
      await handleCheckSubscription(bot, query);
      return;
    }
    await bot.answerCallbackQuery(query.id).catch(() => {});
  }, query);
});

// ---- Guruhga qo'shilish/chiqarilish (my_chat_member) --------------------

bot.on('my_chat_member', (upd) => {
  const chat = upd.chat;
  if (!chat || !(chat.type === 'group' || chat.type === 'supergroup')) return;
  const newStatus = upd.new_chat_member && upd.new_chat_member.status;
  const actor = upd.from || {};
  const actorName = actor.first_name || (actor.username ? '@' + actor.username : 'nomaʼlum');

  wrap(async () => {
    if (newStatus === 'member' || newStatus === 'administrator') {
      let count = 0;
      try {
        count = await bot.getChatMemberCount(chat.id);
      } catch (_) {
        /* ignore */
      }
      storage.addGroup(chat, actor, count);
      await notify.notifyAdmins(
        '➕ <b>Bot guruhga qo\'shildi</b>\n' +
          `📛 ${chat.title || '(nomsiz)'}\n` +
          `🆔 <code>${chat.id}</code>\n` +
          `👤 Qo'shdi: ${actorName}\n` +
          `📊 A'zolar: ${count || '?'}\n` +
          `👥 Jami guruhlar: ${storage.getGroupCount()}`
      );
    } else if (newStatus === 'left' || newStatus === 'kicked') {
      storage.removeGroup(chat.id);
      await notify.notifyAdmins(
        '❌ <b>Bot guruhdan chiqarildi</b>\n' +
          `📛 ${chat.title || '(nomsiz)'}\n` +
          `🆔 <code>${chat.id}</code>\n` +
          `👥 Jami guruhlar: ${storage.getGroupCount()}`
      );
    }
  }, null, true);
});

// «✅ Obunani tekshirish» tugmasi
async function handleCheckSubscription(bot, query) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const sub = await checkSubscription(bot, userId);
  if (sub.ok) {
    await bot.answerCallbackQuery(query.id, {
      text: '✅ Rahmat! Endi havola yuborishingiz mumkin.',
      show_alert: false,
    });
    try {
      await bot.deleteMessage(chatId, query.message.message_id);
    } catch (_) {
      /* ignore */
    }
  } else {
    await bot.answerCallbackQuery(query.id, {
      text: '⛔️ Siz hali barcha kanallarga obuna bo\'lmadingiz.',
      show_alert: true,
    });
    await sendSubscriptionPrompt(bot, chatId, sub.missing);
  }
}

// ---- Umumiy xato o'rovchilar --------------------------------------------

async function wrap(fn, msg, silent) {
  try {
    await fn();
  } catch (err) {
    console.error('[handler xato]', err.stack || err.message);
    // Guruhda umumiy xato xabarini yubormaymiz (spam bo'lmasin).
    if (silent) return;
    try {
      if (msg && msg.chat) {
        await bot.sendMessage(
          msg.chat.id,
          '❌ Kutilmagan xatolik yuz berdi. Birozdan so\'ng qayta urinib ko\'ring.'
        );
      }
    } catch (_) {
      /* ignore */
    }
  }
}

async function wrapCallback(fn, query) {
  try {
    await fn();
  } catch (err) {
    console.error('[callback xato]', err.stack || err.message);
    try {
      await bot.answerCallbackQuery(query.id, {
        text: '❌ Xatolik yuz berdi.',
        show_alert: false,
      });
    } catch (_) {
      /* ignore */
    }
  }
}

console.log('⏳ Bot polling rejimida ishga tushmoqda...');
