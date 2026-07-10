'use strict';

const { execFile } = require('child_process');
const TelegramBot = require('node-telegram-bot-api');
const { config } = require('./config');
const storage = require('./services/storage');
const downloader = require('./services/downloader');

const { handleStart, handleHelp, handleUserStats } = require('./handlers/start');
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

// yt-dlp mavjud va ishlayotganini tekshiramiz (execFile — shell'siz).
function checkYtDlp() {
  execFile(config.YTDLP_PATH, ['--version'], { timeout: 15000 }, (err, stdout) => {
    if (err) {
      console.error(
        `❌ yt-dlp ishlamadi (${config.YTDLP_PATH}): ${err.message}\n` +
          '   Binary yo\'q yoki bajariladigan emas. Deploy loglarini tekshiring.'
      );
      return;
    }
    console.log(`✅ yt-dlp mavjud: v${String(stdout).trim()} (${config.YTDLP_PATH})`);
  });
}
checkYtDlp();

const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

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

// ---- Oddiy xabarlar (URL yoki admin input) ------------------------------

bot.on('message', (msg) => {
  // Buyruqlarni bu yerda o'tkazib yuboramiz (onText allaqachon ushlagan)
  if (msg.text && /^\//.test(msg.text)) return;
  if (!msg.from) return;

  wrap(async () => {
    // Foydalanuvchini ro'yxatga qo'shamiz/yangilaymiz
    storage.upsertUser(msg.from);

    // Avval admin biror qadam kutayotgan bo'lsa — o'sha ushlaydi
    const handledByAdmin = await admin.handleAdminInput(bot, msg);
    if (handledByAdmin) return;

    // Aks holda — URL sifatida ko'rib chiqamiz
    await download.handleUrlMessage(bot, msg);
  }, msg);
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
    if (data === 'check_sub') {
      await handleCheckSubscription(bot, query);
      return;
    }
    await bot.answerCallbackQuery(query.id).catch(() => {});
  }, query);
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

async function wrap(fn, msg) {
  try {
    await fn();
  } catch (err) {
    console.error('[handler xato]', err.stack || err.message);
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
