'use strict';

const storage = require('../utils/storage');
const keyboards = require('../utils/keyboards');
const botInfo = require('../utils/botInfo');
const { formatChat, formatUserId } = require('../utils/format');

// /getid — bitta reply keyboard (kanal + guruh + foydalanuvchi).
async function handleGetIdCommand(bot, chatId) {
  await bot.sendMessage(
    chatId,
    '🆔 <b>ID olish</b>\n\n' +
      'Quyidagi tugmalardan birini bosing:\n' +
      '• <b>📢 Kanal</b> — kanal tanlash oynasi ochiladi\n' +
      '• <b>👥 Guruh</b> — guruh tanlash oynasi ochiladi\n' +
      '• <b>👤 Foydalanuvchi</b> — foydalanuvchi tanlash oynasi ochiladi\n\n' +
      'Yoki kanal / guruhdan istalgan xabarni <b>forward</b> qiling — bot ID ni avtomatik qaytaradi.',
    { parse_mode: 'HTML', ...keyboards.getIdKeyboard() }
  );
}

// Bir ChatMember'dan ko'rsatiladigan nomni yasaydi.
function memberName(m) {
  const u = m.user || {};
  if (u.username) return `@${u.username}`;
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || String(u.id);
}

// Chat'ni getChat + getChatMemberCount + getChatAdministrators bilan boyitadi.
// Admin ma'lumotlari faqat bot chatga a'zo bo'lsa keladi (aks hola jimgina o'tkazib yuboriladi).
// Qaytaradi: { info, extra }.
async function enrichChat(bot, fallbackInfo, chatIdForCount) {
  let info = fallbackInfo;
  const extra = {};
  try {
    info = await bot.getChat(chatIdForCount);
  } catch (_) {
    /* bot a'zo bo'lmasa getChat ishlamaydi — fallback bilan davom */
  }
  try {
    extra.member_count = await bot.getChatMemberCount(chatIdForCount);
    extra.bot_in_chat = true;
  } catch (_) {
    /* a'zolar sonini olib bo'lmasa — ko'rsatmaymiz */
  }
  try {
    const admins = await bot.getChatAdministrators(chatIdForCount);
    extra.admin_count = admins.length;
    extra.bot_in_chat = true;
    const creator = admins.find((a) => a.status === 'creator');
    if (creator) {
      extra.creator = memberName(creator);
      extra.creator_id = creator.user && creator.user.id;
    }
  } catch (_) {
    /* bot a'zo/admin bo'lmasa adminlarni olib bo'lmaydi — ko'rsatmaymiz */
  }
  return { info, extra };
}

// Chat natijasi uchun matn + tegishli reply_markup ni tayyorlaydi.
// Bot a'zo bo'lmagan guruh/kanal bo'lsa — "Botni qo'shish" tugmasi qo'shiladi.
function buildChatResult(info, extra) {
  let text = formatChat(info, extra);
  const type = info.type;
  const isGroupOrChannel = ['group', 'supergroup', 'channel'].includes(type);
  const uname = botInfo.username();

  if (!extra.bot_in_chat && isGroupOrChannel && uname) {
    text +=
      '\n\nℹ️ To\'liq ma\'lumot (a\'zolar soni, adminlar, egasi) uchun ' +
      'botni shu ' +
      (type === 'channel' ? 'kanalga admin qiling' : 'guruhga qo\'shing') +
      ':';
    return { text, options: { parse_mode: 'HTML', ...keyboards.addToChatKeyboard(uname, type) } };
  }
  return { text, options: { parse_mode: 'HTML', ...keyboards.removeKeyboard() } };
}

// msg.chat_shared — request_chat javobi.
// request_id 1 = kanal, 2 = guruh.
async function handleChatShared(bot, msg) {
  const chatId = msg.chat.id;
  const shared = msg.chat_shared;
  const isChannel = shared.request_id === 1;
  storage.incStat('getId', isChannel ? 'channel' : 'group');

  const fallback = {
    id: shared.chat_id,
    type: isChannel ? 'channel' : 'supergroup',
    title: shared.title,
    username: shared.username,
  };
  const { info, extra } = await enrichChat(bot, fallback, shared.chat_id);

  const { text, options } = buildChatResult(info, extra);
  await bot.sendMessage(chatId, text, options);
}

// msg.users_shared — request_users javobi.
async function handleUsersShared(bot, msg) {
  const chatId = msg.chat.id;
  storage.incStat('getId', 'user');

  const shared = msg.users_shared;
  // Bot API yangi: users[]; eski: user_ids[].
  const list = shared.users || (shared.user_ids || []).map((id) => ({ user_id: id }));

  if (!list.length) {
    await bot.sendMessage(chatId, '❌ Foydalanuvchi tanlanmadi.', keyboards.removeKeyboard());
    return;
  }

  const parts = list.map((u) =>
    formatUserId(u.user_id, {
      first_name: u.first_name,
      last_name: u.last_name,
      username: u.username,
    })
  );
  await bot.sendMessage(chatId, parts.join('\n\n———\n\n'), {
    parse_mode: 'HTML',
    ...keyboards.removeKeyboard(),
  });
}

// Forward qilingan xabar — msg.forward_from_chat yoki msg.forward_from.
async function handleForward(bot, msg) {
  const chatId = msg.chat.id;

  if (msg.forward_from_chat) {
    storage.incStat('getId', 'forward');
    const { info, extra } = await enrichChat(
      bot,
      msg.forward_from_chat,
      msg.forward_from_chat.id
    );
    const { text, options } = buildChatResult(info, extra);
    await bot.sendMessage(chatId, text, options);
    return true;
  }

  if (msg.forward_from) {
    storage.incStat('getId', 'forward');
    const u = msg.forward_from;
    await bot.sendMessage(
      chatId,
      formatUserId(u.id, {
        first_name: u.first_name,
        last_name: u.last_name,
        username: u.username,
      }),
      { parse_mode: 'HTML' }
    );
    return true;
  }

  if (msg.forward_date || msg.forward_sender_name) {
    await bot.sendMessage(
      chatId,
      'ℹ️ Bu xabar forward qilingan, lekin manba maxfiylik sozlamalari sababli ' +
        'yashirilgan — ID ni olishning iloji yo\'q.'
    );
    return true;
  }

  return false;
}

module.exports = {
  handleGetIdCommand,
  handleChatShared,
  handleUsersShared,
  handleForward,
};
