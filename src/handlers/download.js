'use strict';

const fs = require('fs');
const storage = require('../services/storage');
const downloader = require('../services/downloader');
const urlcache = require('../services/urlcache');
const acrcloud = require('../services/acrcloud');
const media = require('../services/media');
const notify = require('../services/notify');
const ratelimit = require('../services/ratelimit');
const { config, acrEnabled } = require('../config');
const { extractUrl, detectPlatform, isYouTube } = require('../utils/platform');
const {
  youtubeFormatKeyboard,
  audioButtonKeyboard,
  searchPageKeyboard,
} = require('../utils/keyboard');
const { checkSubscription, sendSubscriptionPrompt } = require('./subscription');

// Bir vaqtda bitta foydalanuvchi faqat 1 ta yuklash qila oladi.
const activeDownloads = new Set();

// YouTube format tanlash uchun: token -> { url, chatId, userId, createdAt }
const pendingYouTube = new Map();
const PENDING_TTL_MS = 10 * 60 * 1000; // 10 daqiqa

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

// Har bir yuborishga reply + "javobsiz ham yubor" opsiyalari.
function replyOpts(msg, extra = {}) {
  return {
    reply_to_message_id: msg.message_id,
    allow_sending_without_reply: true,
    ...extra,
  };
}

// recordDownload + har 100-yuklashda adminlarga xabar.
function afterDownload(platform) {
  const total = storage.recordDownload(platform);
  if (total > 0 && total % 100 === 0) {
    notify.notifyAdmins(
      `📥 <b>${total}</b> ta yuklashga yetdik!\n` +
        `👥 Foydalanuvchilar: ${storage.getUserCount()}`
    );
  }
}

// ==== VIDEO ================================================================

async function performDownload(
  bot,
  { origMsg, chatId, userId, url, platform, opts, statusMsg, allowImageFallback }
) {
  if (activeDownloads.has(userId)) {
    await bot.sendMessage(
      chatId,
      '⏳ Sizning oldingi yuklashingiz hali tugamadi. Iltimos, kuting.',
      replyOpts(origMsg)
    );
    return;
  }
  activeDownloads.add(userId);

  const editStatus = async (text) => {
    if (!statusMsg) {
      statusMsg = await bot.sendMessage(chatId, text, replyOpts(origMsg));
      return;
    }
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
      });
    } catch (_) {
      /* o'zgarmagan/o'chirilgan bo'lsa e'tibor bermaymiz */
    }
  };

  let result = null;
  try {
    await editStatus('⏳ Yuklanmoqda...');
    result = await downloader.downloadVideo(url, opts);
    await editStatus('📤 Yuborilmoqda...');

    // Videoga "🎵 Audio (MP3)" tugmasini biriktiramiz (urlcache orqali).
    const cacheId = urlcache.put(url, { platform: platform.name });
    const sendOpts = replyOpts(origMsg, {
      caption: caption(),
      supports_streaming: true,
      reply_markup: audioButtonKeyboard(cacheId),
    });

    try {
      await bot.sendVideo(chatId, result.filePath, sendOpts);
    } catch (sendErr) {
      console.error('[download] sendVideo xato, document sifatida:', sendErr.message);
      await bot.sendDocument(
        chatId,
        result.filePath,
        replyOpts(origMsg, { caption: caption(), reply_markup: audioButtonKeyboard(cacheId) })
      );
    }

    afterDownload(platform.name);
    storage.incrementUserDownloads(userId, platform.name);

    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (_) {
        /* ignore */
      }
    }
  } catch (err) {
    // Video topilmasa va ruxsat bo'lsa — rasm sifatida urinib ko'ramiz.
    if (allowImageFallback && err instanceof downloader.NoVideoError) {
      activeDownloads.delete(userId);
      await performImageDownload(bot, { origMsg, chatId, userId, url, platform, statusMsg });
      return;
    }
    await handleDownloadError(bot, { chatId, platform, err, editStatus });
  } finally {
    if (result) downloader.removeFile(result.filePath, result.token);
    activeDownloads.delete(userId);
  }
}

// ==== RASM (gallery-dl) ====================================================

async function performImageDownload(bot, { origMsg, chatId, userId, url, platform, statusMsg }) {
  if (activeDownloads.has(userId)) {
    await bot.sendMessage(chatId, '⏳ Oldingi yuklash tugamadi, kuting.', replyOpts(origMsg));
    return;
  }
  activeDownloads.add(userId);

  const editStatus = async (text) => {
    if (!statusMsg) {
      statusMsg = await bot.sendMessage(chatId, text, replyOpts(origMsg));
      return;
    }
    try {
      await bot.editMessageText(text, { chat_id: chatId, message_id: statusMsg.message_id });
    } catch (_) {
      /* ignore */
    }
  };

  let res = null;
  try {
    await editStatus('⏳ Rasm(lar) yuklanmoqda...');
    res = await downloader.downloadImages(url, { max: 10 });
    if (!res.files.length) {
      await editStatus(
        '❌ Bu havoladan media topilmadi. Havola noto\'g\'ri yoki maxfiy bo\'lishi mumkin.'
      );
      return;
    }
    await sendImages(bot, chatId, origMsg, res.files);

    afterDownload(platform.name);
    storage.incrementUserDownloads(userId, platform.name);

    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (_) {
        /* ignore */
      }
    }
  } catch (err) {
    console.error('[images] xato:', err.stderr || err.message);
    await editStatus(
      '❌ Media yuklab bo\'lmadi. Havola noto\'g\'ri, maxfiy yoki o\'chirilgan bo\'lishi mumkin.'
    );
  } finally {
    if (res) downloader.removeDir(res.dir);
    activeDownloads.delete(userId);
  }
}

async function sendImages(bot, chatId, origMsg, files) {
  const cap = caption();
  if (files.length === 1) {
    await bot.sendPhoto(chatId, files[0], replyOpts(origMsg, { caption: cap }));
    return;
  }
  const group = files.slice(0, 10).map((f, i) => ({
    type: 'photo',
    media: fs.createReadStream(f),
    caption: i === 0 ? cap : undefined,
  }));
  try {
    await bot.sendMediaGroup(chatId, group, {
      reply_to_message_id: origMsg.message_id,
      allow_sending_without_reply: true,
    });
  } catch (err) {
    // Media group ba'zan ishlamasa — birma-bir yuboramiz.
    console.error('[images] sendMediaGroup xato, birma-bir:', err.message);
    for (let i = 0; i < files.length; i += 1) {
      try {
        await bot.sendPhoto(chatId, files[i], i === 0 ? replyOpts(origMsg, { caption: cap }) : {});
      } catch (_) {
        /* ignore */
      }
    }
  }
}

// ==== AUDIO (MP3) ==========================================================

async function performAudio(
  bot,
  { chatId, userId, url, meta, replyToMessageId, statusMessageId, retryData }
) {
  if (activeDownloads.has(userId)) {
    await bot.sendMessage(chatId, '⏳ Oldingi yuklash tugamadi, kuting.');
    return;
  }
  activeDownloads.add(userId);

  // Status matnini (va xatoda retry tugmasini) yangilaydigan yordamchi.
  const editStatus = async (text, withRetry) => {
    if (!statusMessageId) return;
    const opts = { chat_id: chatId, message_id: statusMessageId };
    if (withRetry && retryData) {
      opts.reply_markup = {
        inline_keyboard: [[{ text: '🔄 Qayta urinish', callback_data: retryData }]],
      };
    }
    try {
      await bot.editMessageText(text, opts);
    } catch (_) {
      /* ignore */
    }
  };

  let res = null;
  try {
    await editStatus('⏳ Audio yuklanmoqda...');
    res = await downloader.downloadAudio(url, meta || {});
    await bot.sendAudio(chatId, res.filePath, {
      caption: caption(),
      title: res.title,
      performer: res.performer,
      duration: res.duration,
      reply_to_message_id: replyToMessageId,
      allow_sending_without_reply: true,
    });

    storage.recordMp3Download();
    afterDownload('audio');
    storage.incrementUserDownloads(userId, 'audio');

    // Muvaffaqiyatda status xabarini o'chiramiz
    if (statusMessageId) {
      try {
        await bot.deleteMessage(chatId, statusMessageId);
      } catch (_) {
        /* ignore */
      }
    }
  } catch (err) {
    console.error('[audio] xato:', err.stderr || err.message);
    if (err instanceof downloader.TooLargeError) {
      await editStatus(
        `❌ Audio hajmi ${err.sizeMb}MB — Telegram orqali yuborib bo\'lmaydi ` +
          `(limit ${downloader.MAX_MB}MB).`
      );
    } else if (err instanceof downloader.BotCheckError) {
      await editStatus(
        '❌ Manba bloklandi. Birozdan so\'ng qayta urinib ko\'ring.',
        true
      );
    } else if (err && err.code === 'TIMEOUT') {
      await editStatus(
        '❌ Audio yuklash juda uzoq davom etdi (120s) va to\'xtatildi. Qayta urinib ko\'ring.',
        true
      );
    } else {
      await editStatus(
        '❌ Audioni yuklab bo\'lmadi. Qayta urinib ko\'ring yoki boshqa natijani tanlang.',
        true
      );
    }
  } finally {
    if (res) downloader.removeFile(res.filePath, res.token);
    activeDownloads.delete(userId);
  }
}

// ==== Xato xabarlari =======================================================

async function handleDownloadError(bot, { chatId, platform, err, editStatus }) {
  console.error(`[download] Xato (${platform ? platform.name : '?'}):`, err.stderr || err.message);

  if (err instanceof downloader.BotCheckError) {
    if (downloader.hasCookies()) {
      // Cookies bor bo'lsa ham chiqsa — eskirgan bo'lishi mumkin.
      await editStatus(
        '❌ YouTube so\'rovni bloklamoqda. Cookies eskirgan bo\'lishi mumkin — ' +
          'birozdan so\'ng qayta urinib ko\'ring.'
      );
      notify.notifyAdmins(
        '⚠️ <b>YouTube bot-check</b> cookies BOR holatda ham chiqdi.\n' +
          'Cookies eskirgan bo\'lishi mumkin — <code>YTDLP_COOKIES_B64</code> ni yangilang.'
      );
    } else {
      await editStatus(
        '❌ YouTube ushbu so\'rovni bloklamoqda («bot emasligingizni tasdiqlang»).\n\n' +
          'Iltimos, birozdan so\'ng qayta urinib ko\'ring yoki boshqa video yuboring.'
      );
    }
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
  // "Requested format is not available" — YouTube shu videoni cheklagan.
  const errText = `${err.stderr || ''} ${err.message || ''}`.toLowerCase();
  if (errText.includes('requested format is not available') || errText.includes('no such format')) {
    await editStatus(
      '❌ Bu videoni yuklab bo\'lmadi — YouTube uni cheklagan bo\'lishi mumkin ' +
        '(yosh chegarasi, region yoki faqat a\'zolar uchun). Boshqa video bilan urinib ko\'ring.'
    );
    return;
  }
  await editStatus(
    '❌ Yuklab bo\'lmadi. Havola noto\'g\'ri, media maxfiy yoki ' +
      'o\'chirilgan bo\'lishi mumkin. Boshqa havola bilan urinib ko\'ring.'
  );
}

// ==== URL handler ==========================================================

// Havolali xabarni ishlaydi. isGroup=true bo'lsa: qo'llab-quvvatlanmagan
// havola/oddiy matnga jim turadi, majburiy obuna tekshirilmaydi.
// Qaytaradi: true — xabar ishlangan (URL topildi), false — URL yo'q.
async function handleUrlMessage(bot, msg, { isGroup = false } = {}) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const url = extractUrl(msg.text || msg.caption);
  if (!url) return false;

  const platform = detectPlatform(url);
  if (!platform) {
    if (isGroup) return false; // guruhda begona havolaga aralashmaymiz
    await bot.sendMessage(
      chatId,
      '❌ Bu havola qo\'llab-quvvatlanmaydi.\n\n' +
        'Qo\'llab-quvvatlanadigan platformalar: Instagram, TikTok, YouTube, ' +
        'Facebook, Twitter/X, Pinterest, Likee.',
      replyOpts(msg)
    );
    return true;
  }

  // Guruhda ko'rilgan foydalanuvchini 'group' manbasi bilan qayd qilamiz.
  if (isGroup) storage.upsertUser(msg.from, 'group');

  // Anti-flood: bir xil URL 30s ichida qayta kelsa — jimgina o'tkazamiz.
  if (ratelimit.isDuplicate(msg.from, url)) return true;

  // Rate limiting: daqiqasiga max 5 yuklash so'rovi.
  if (!ratelimit.checkRate(msg.from)) {
    await bot.sendMessage(
      chatId,
      `⏳ Sekinroq — 1 daqiqada maksimal ${ratelimit.MAX_PER_WINDOW} ta yuklash.`,
      replyOpts(msg)
    );
    return true;
  }

  // Majburiy obuna — shaxsiy chatda ham, guruhda ham tekshiriladi.
  const sub = await checkSubscription(bot, userId);
  if (!sub.ok) {
    await sendSubscriptionPrompt(bot, chatId, sub.missing, {
      userId,
      short: isGroup,
      replyToMessageId: isGroup ? msg.message_id : undefined,
    });
    return true;
  }

  // Pinterest — to'g'ridan-to'g'ri rasm oqimi
  if (platform.name === 'pinterest') {
    await performImageDownload(bot, { origMsg: msg, chatId, userId, url, platform });
    return true;
  }

  // YouTube — format tanlash tugmalari
  if (isYouTube(platform.name)) {
    const token = downloader.makeToken();
    pendingYouTube.set(token, { url, chatId, userId, createdAt: Date.now() });
    await bot.sendMessage(chatId, '🎬 Formatni tanlang:', {
      ...replyOpts(msg),
      reply_markup: youtubeFormatKeyboard(token),
    });
    return true;
  }

  // Boshqa platformalar — video (topilmasa rasmga fallback)
  const statusMsg = await bot.sendMessage(chatId, '⏳ Yuklanmoqda...', replyOpts(msg));
  await performDownload(bot, {
    origMsg: msg,
    chatId,
    userId,
    url,
    platform,
    opts: { quality: 'best' },
    statusMsg,
    allowImageFallback: true,
  });
  return true;
}

// ==== Musiqa qidiruvi (matn) ===============================================

async function handleTextSearch(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const query = (msg.text || '').trim();
  if (!query) return;

  // Faqat shaxsiy chatda chaqiriladi — obunani tekshiramiz
  const sub = await checkSubscription(bot, userId);
  if (!sub.ok) {
    await sendSubscriptionPrompt(bot, chatId, sub.missing);
    return;
  }

  const statusMsg = await bot.sendMessage(chatId, '🔎 Qidirilmoqda...', replyOpts(msg));
  await runSearchAndShow(bot, { chatId, query, statusMsg, headerTitle: null });
}

// Qidiruv + natijalarni sahifalab ko'rsatish (matn va ovoz uchun umumiy).
async function runSearchAndShow(bot, { chatId, query, statusMsg, headerTitle }) {
  storage.recordMusicSearch();

  let results = [];
  try {
    results = await downloader.search(query, 'sc', 15); // SoundCloud — cookies talab qilmaydi
    if (!results.length) {
      results = await downloader.search(query, 'yt', 15); // YouTube — cookies bilan
    }
  } catch (err) {
    console.error('[search] xato:', err.stderr || err.message);
  }

  if (!results.length) {
    await bot
      .editMessageText('❌ Hech narsa topilmadi. Boshqacha yozib ko\'ring.', {
        chat_id: chatId,
        message_id: statusMsg.message_id,
      })
      .catch(() => {});
    return;
  }

  // Har bir natijani alohida urlcache yozuvi sifatida saqlaymiz (song:<id>).
  const items = results.map((r) => {
    const id = urlcache.put(r.url, {
      title: r.title,
      uploader: r.uploader,
      duration: r.duration,
    });
    return { id, title: r.title, uploader: r.uploader, duration: r.duration };
  });

  // Butun qidiruv sessiyasini ham saqlaymiz — sahifalash uchun (page:<searchId>:<n>).
  const searchId = urlcache.put('', { type: 'search', items });

  const header = headerTitle
    ? `🎵 ${headerTitle}\n\nBirini tanlang:`
    : '🎵 Natijalar — birini tanlang:';
  await bot
    .editMessageText(header, {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      reply_markup: searchPageKeyboard(searchId, items, 0),
    })
    .catch(() => {});
}

// Sahifalash tugmasi — callback: "page:<searchId>:<page>"
async function handlePageCallback(bot, query) {
  const chatId = query.message.chat.id;
  const parts = query.data.split(':');
  const searchId = parts[1];
  const page = parseInt(parts[2], 10) || 0;

  const entry = urlcache.get(searchId);
  if (!entry || !entry.meta || entry.meta.type !== 'search') {
    await bot.answerCallbackQuery(query.id, {
      text: '⚠️ Qidiruv eskirgan. Qayta qidiring.',
      show_alert: true,
    });
    return;
  }
  await bot.answerCallbackQuery(query.id).catch(() => {});

  // Faqat klaviaturani yangilaymiz — xabar qayta yuborilmaydi.
  try {
    await bot.editMessageReplyMarkup(searchPageKeyboard(searchId, entry.meta.items, page), {
      chat_id: chatId,
      message_id: query.message.message_id,
    });
  } catch (_) {
    /* "not modified" bo'lsa e'tibor bermaymiz */
  }
}

// ==== Musiqa aniqlash (ovozli xabar) =======================================

async function handleVoiceRecognition(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!acrEnabled()) {
    await bot.sendMessage(chatId, '🎙 Bu funksiya hozircha sozlanmagan.', replyOpts(msg));
    return;
  }

  // Obuna (shaxsiy chatda)
  const sub = await checkSubscription(bot, userId);
  if (!sub.ok) {
    await sendSubscriptionPrompt(bot, chatId, sub.missing);
    return;
  }

  const media0 = msg.voice || msg.audio || msg.video_note;
  if (!media0) return;

  const statusMsg = await bot.sendMessage(chatId, '🎧 Musiqa aniqlanmoqda...', replyOpts(msg));
  let inputPath = null;
  let wavPath = null;
  try {
    inputPath = await bot.downloadFile(media0.file_id, config.DOWNLOADS_DIR);
    wavPath = await media.toSampleWav(inputPath, 12);

    const found = await acrcloud.identify(wavPath);
    if (!found) {
      await bot
        .editMessageText('❌ Aniqlab bo\'lmadi. Qo\'shiq nomini matn bilan yozib ko\'ring.', {
          chat_id: chatId,
          message_id: statusMsg.message_id,
        })
        .catch(() => {});
      return;
    }

    const label = `${found.title}${found.artist ? ' — ' + found.artist : ''}`;
    await bot
      .editMessageText(`✅ Topildi: <b>${escapeHtml(label)}</b>\n\n🔎 Yuklab olish uchun qidirilmoqda...`, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'HTML',
      })
      .catch(() => {});

    const query = `${found.artist} ${found.title}`.trim();
    await runSearchAndShow(bot, { chatId, query, statusMsg, headerTitle: label });
  } catch (err) {
    console.error('[voice] xato:', err.stderr || err.message);
    await bot
      .editMessageText('❌ Aniqlashda xatolik. Qo\'shiq nomini matn bilan yozib ko\'ring.', {
        chat_id: chatId,
        message_id: statusMsg.message_id,
      })
      .catch(() => {});
  } finally {
    media.safeUnlink(inputPath);
    media.safeUnlink(wavPath);
  }
}

// ==== Callback'lar =========================================================

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

  const sub = await checkSubscription(bot, userId);
  if (!sub.ok) {
    await sendSubscriptionPrompt(bot, chatId, sub.missing);
    return;
  }

  const statusMsg = query.message;
  const editStatus = async (text) => {
    try {
      await bot.editMessageText(text, { chat_id: chatId, message_id: statusMsg.message_id });
    } catch (_) {
      /* ignore */
    }
  };

  if (action === 'mp3') {
    // Retry uchun URL'ni urlcache'ga saqlaymiz (mp3:<id> tugmasi orqali qayta urinish).
    const retryId = urlcache.put(pending.url, {});
    await performAudio(bot, {
      chatId,
      userId,
      url: pending.url,
      meta: {},
      replyToMessageId: statusMsg.message_id,
      statusMessageId: statusMsg.message_id,
      retryData: `mp3:${retryId}`,
    });
    return;
  }

  const opts = action === '360' ? { quality: '360' } : { quality: '720' };
  await editStatus('⏳ Yuklanmoqda...');
  await performDownload(bot, {
    origMsg: statusMsg,
    chatId,
    userId,
    url: pending.url,
    platform: { name: 'youtube', label: 'YouTube' },
    opts,
    statusMsg,
  });
}

// "🎵 Audio (MP3)" tugmasi (video ostida) — callback: "mp3:<id>"
async function handleMp3Callback(bot, query) {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const id = query.data.split(':')[1];

  const entry = urlcache.get(id);
  if (!entry) {
    await bot.answerCallbackQuery(query.id, {
      text: '⚠️ Havola eskirgan. Videoni qayta yuboring.',
      show_alert: true,
    });
    return;
  }
  await bot.answerCallbackQuery(query.id, { text: '🎵 Audio tayyorlanmoqda...' }).catch(() => {});

  const statusMsg = await bot.sendMessage(chatId, '⏳ Audio yuklanmoqda...', {
    reply_to_message_id: query.message.message_id,
    allow_sending_without_reply: true,
  });

  await performAudio(bot, {
    chatId,
    userId,
    url: entry.url,
    meta: entry.meta || {},
    replyToMessageId: query.message.message_id,
    statusMessageId: statusMsg.message_id,
    retryData: `mp3:${id}`,
  });
}

// Qidiruv natijasi tanlangan — callback: "song:<id>"
async function handleSongCallback(bot, query) {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const id = query.data.split(':')[1];

  const entry = urlcache.get(id);
  if (!entry) {
    await bot.answerCallbackQuery(query.id, {
      text: '⚠️ Natija eskirgan. Qayta qidiring.',
      show_alert: true,
    });
    return;
  }
  await bot.answerCallbackQuery(query.id, { text: '🎵 Yuklanmoqda...' }).catch(() => {});

  const statusMsg = await bot.sendMessage(chatId, '⏳ Audio yuklanmoqda...', {
    reply_to_message_id: query.message.message_id,
    allow_sending_without_reply: true,
  });

  await performAudio(bot, {
    chatId,
    userId,
    url: entry.url,
    meta: entry.meta || {},
    replyToMessageId: query.message.message_id,
    statusMessageId: statusMsg.message_id,
    retryData: `song:${id}`,
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

module.exports = {
  handleUrlMessage,
  handleTextSearch,
  handleVoiceRecognition,
  handleYouTubeCallback,
  handleMp3Callback,
  handleSongCallback,
  handlePageCallback,
  setBotUsername,
};
