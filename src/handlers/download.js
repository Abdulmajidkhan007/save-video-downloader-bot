'use strict';

const fs = require('fs');
const storage = require('../services/storage');
const downloader = require('../services/downloader');
const { extractUrl, detectPlatform, isYouTube } = require('../utils/platform');
const { youtubeFormatKeyboard } = require('../utils/keyboard');
const { checkSubscription, sendSubscriptionPrompt } = require('./subscription');

// Bir vaqtda bitta foydalanuvchi faqat 1 ta yuklash qila oladi.
const activeDownloads = new Set();

// YouTube format tanlash uchun: token -> { url, chatId, userId, createdAt }
const pendingYouTube = new Map();
const PENDING_TTL_MS = 10 * 60 * 1000; // 10 daqiqa

// Eski pending yozuvlarni tozalab turamiz.
function gcPending() {
  const now = Date.now();
  for (const [token, v] of pendingYouTube.entries()) {
    if (now - v.createdAt > PENDING_TTL_MS) pendingYouTube.delete(token);
  }
}
setInterval(gcPending, 60 * 1000).unref();

let BOT_USERNAME = '';
function setBotUsername(username) {
  BOT_USERNAME = username || '';
}

function caption() {
  return BOT_USERNAME ? `📥 @${BOT_USERNAME} orqali yuklandi` : '📥 Yuklandi';
}

// Umumiy yuklash + yuborish jarayoni.
// statusMsg — "⏳ Yuklanmoqda..." xabari (tahrirlaymiz / o'chiramiz).
async function performDownload(bot, { chatId, userId, url, platform, opts, statusMsg }) {
  if (activeDownloads.has(userId)) {
    await bot.sendMessage(
      chatId,
      '⏳ Sizning oldingi yuklashingiz hali tugamadi. Iltimos, kuting.'
    );
    return;
  }
  activeDownloads.add(userId);

  const editStatus = async (text) => {
    if (!statusMsg) {
      statusMsg = await bot.sendMessage(chatId, text);
      return;
    }
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
      });
    } catch (_) {
      /* xabar o'zgarmagan bo'lsa yoki o'chirilgan bo'lsa — e'tibor bermaymiz */
    }
  };

  let result = null;
  try {
    await editStatus('⏳ Yuklanmoqda...');
    result = await downloader.downloadVideo(url, opts);

    await editStatus('📤 Yuborilmoqda...');

    const isAudio = Boolean(opts.audioOnly);
    const sendOpts = { caption: caption() };

    if (isAudio) {
      await bot.sendAudio(chatId, result.filePath, sendOpts);
    } else {
      // sendVideo ba'zan katta fayllarda muammo bersa document sifatida yuboramiz.
      try {
        await bot.sendVideo(chatId, result.filePath, {
          ...sendOpts,
          supports_streaming: true,
        });
      } catch (sendErr) {
        console.error('[download] sendVideo xato, document sifatida:', sendErr.message);
        await bot.sendDocument(chatId, result.filePath, sendOpts);
      }
    }

    // Statistika + foydalanuvchi hisobi
    storage.recordDownload(platform.name);
    storage.incrementUserDownloads(userId);

    // Status xabarini o'chiramiz
    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (_) {
        /* ignore */
      }
    }
  } catch (err) {
    await handleDownloadError(bot, { chatId, platform, err, editStatus });
  } finally {
    // Vaqtinchalik faylni DARHOL o'chiramiz
    if (result) downloader.removeFile(result.filePath, result.token);
    activeDownloads.delete(userId);
  }
}

async function handleDownloadError(bot, { chatId, platform, err, editStatus }) {
  console.error(`[download] Xato (${platform ? platform.name : '?'}):`, err.stderr || err.message);

  if (err instanceof downloader.BotCheckError) {
    await editStatus(
      '❌ YouTube ushbu so\'rovni bloklamoqda («bot emasligingizni tasdiqlang»).\n\n' +
        'Bu odatda server IP manzili bilan bog\'liq. Iltimos, birozdan so\'ng ' +
        'qayta urinib ko\'ring yoki boshqa video yuboring.'
    );
    return;
  }
  if (err instanceof downloader.TooLargeError) {
    await editStatus(
      `❌ Video hajmi ${err.sizeMb}MB — Telegram orqali yuborib bo\'lmaydi ` +
        `(limit ${downloader.MAX_MB}MB).\n\n` +
        'YouTube uchun pastroq sifat (360p) tanlab ko\'ring.'
    );
    return;
  }
  await editStatus(
    '❌ Videoni yuklab bo\'lmadi. Havola noto\'g\'ri, video maxfiy yoki ' +
      'o\'chirilgan bo\'lishi mumkin. Boshqa havola bilan urinib ko\'ring.'
  );
}

// URL yuborilganda ishlaydigan asosiy handler.
async function handleUrlMessage(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const url = extractUrl(msg.text);
  if (!url) return; // URL bo'lmasa e'tibor bermaymiz

  const platform = detectPlatform(url);
  if (!platform) {
    await bot.sendMessage(
      chatId,
      '❌ Bu havola qo\'llab-quvvatlanmaydi.\n\n' +
        'Qo\'llab-quvvatlanadigan platformalar: Instagram, TikTok, YouTube, ' +
        'Facebook, Twitter/X, Pinterest, Likee.'
    );
    return;
  }

  // Majburiy obunani tekshiramiz
  const sub = await checkSubscription(bot, userId);
  if (!sub.ok) {
    await sendSubscriptionPrompt(bot, chatId, sub.missing);
    return;
  }

  // YouTube — format tanlash tugmalari
  if (isYouTube(platform.name)) {
    const token = downloader.makeToken();
    pendingYouTube.set(token, { url, chatId, userId, createdAt: Date.now() });
    await bot.sendMessage(chatId, '🎬 Formatni tanlang:', {
      reply_markup: youtubeFormatKeyboard(token),
    });
    return;
  }

  // Boshqa platformalar — to'g'ridan-to'g'ri eng yaxshi sifatda
  const statusMsg = await bot.sendMessage(chatId, '⏳ Yuklanmoqda...');
  await performDownload(bot, {
    chatId,
    userId,
    url,
    platform,
    opts: { quality: 'best' },
    statusMsg,
  });
}

// YouTube format tugmasi bosilganda (callback: "yt|<action>|<token>").
async function handleYouTubeCallback(bot, query) {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const parts = query.data.split('|');
  const action = parts[1];
  const token = parts[2];

  const pending = pendingYouTube.get(token);
  await bot.answerCallbackQuery(query.id).catch(() => {});

  if (!pending || pending.userId !== userId) {
    try {
      await bot.editMessageText('⚠️ Ushbu so\'rov eskirgan. Havolani qayta yuboring.', {
        chat_id: chatId,
        message_id: query.message.message_id,
      });
    } catch (_) {
      /* ignore */
    }
    return;
  }
  pendingYouTube.delete(token);

  // Obunani qayta tekshiramiz (foydalanuvchi tugma bosguncha o'zgargan bo'lishi mumkin)
  const sub = await checkSubscription(bot, userId);
  if (!sub.ok) {
    await sendSubscriptionPrompt(bot, chatId, sub.missing);
    return;
  }

  let opts;
  if (action === 'mp3') opts = { audioOnly: true };
  else if (action === '360') opts = { quality: '360' };
  else opts = { quality: '720' };

  // Tugmalar xabarini status xabariga aylantiramiz
  const statusMsg = query.message;
  try {
    await bot.editMessageText('⏳ Yuklanmoqda...', {
      chat_id: chatId,
      message_id: statusMsg.message_id,
    });
  } catch (_) {
    /* ignore */
  }

  await performDownload(bot, {
    chatId,
    userId,
    url: pending.url,
    platform: { name: 'youtube', label: 'YouTube' },
    opts,
    statusMsg,
  });
}

module.exports = {
  handleUrlMessage,
  handleYouTubeCallback,
  setBotUsername,
};
