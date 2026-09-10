'use strict';

const storage = require('../utils/storage');
const keyboards = require('../utils/keyboards');
const state = require('../utils/state');
const { isAdmin } = require('../config');

// Admin panel (callback: admin:menu).
async function showAdminMenu(bot, query) {
  if (!isAdmin(query.from.id)) {
    return bot.answerCallbackQuery(query.id, { text: '⛔ Ruxsat yo\'q.', show_alert: true });
  }
  await bot.answerCallbackQuery(query.id);
  await bot.editMessageText('🛠 <b>Admin panel</b>\n\nBo\'limni tanlang:', {
    chat_id: query.message.chat.id,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    ...keyboards.adminMenu(),
  });
}

// admin:stats
async function showStats(bot, query) {
  if (!isAdmin(query.from.id)) {
    return bot.answerCallbackQuery(query.id, { text: '⛔ Ruxsat yo\'q.', show_alert: true });
  }
  await bot.answerCallbackQuery(query.id);

  const users = storage.getUsers();
  const stats = storage.getStats();
  const s = stats.searches || {};
  const g = stats.getId || {};
  const i = stats.inline || {};
  const totalSearch = (s.by_id || 0) + (s.by_username || 0) + (s.by_phone || 0);
  const totalGetId = (g.channel || 0) + (g.group || 0) + (g.user || 0) + (g.forward || 0);
  const totalInline = (i.self || 0) + (i.by_id || 0) + (i.by_username || 0);

  const text =
    '📊 <b>Statistika</b>\n\n' +
    `👥 Jami foydalanuvchilar: <b>${users.length}</b>\n\n` +
    `🔍 <b>Qidiruvlar</b> (jami: ${totalSearch})\n` +
    `  • 🔢 ID orqali: ${s.by_id || 0}\n` +
    `  • 📛 Username orqali: ${s.by_username || 0}\n` +
    `  • 📞 Telefon orqali: ${s.by_phone || 0}\n\n` +
    `🆔 <b>ID olish</b> (jami: ${totalGetId})\n` +
    `  • 📢 Kanal: ${g.channel || 0}\n` +
    `  • 👥 Group: ${g.group || 0}\n` +
    `  • 👤 User: ${g.user || 0}\n` +
    `  • ↪️ Forward: ${g.forward || 0}\n\n` +
    `⚡ <b>Inline qidiruvlar</b> (jami: ${totalInline})\n` +
    `  • 👤 O'z ID (bo'sh so'rov): ${i.self || 0}\n` +
    `  • 🔢 ID orqali: ${i.by_id || 0}\n` +
    `  • 📛 Username orqali: ${i.by_username || 0}`;

  await bot.editMessageText(text, {
    chat_id: query.message.chat.id,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'admin:menu' }]],
    },
  });
}

// admin:channels
async function showChannels(bot, query) {
  if (!isAdmin(query.from.id)) {
    return bot.answerCallbackQuery(query.id, { text: '⛔ Ruxsat yo\'q.', show_alert: true });
  }
  await bot.answerCallbackQuery(query.id);
  const channels = storage.getChannels();
  const list = channels.length
    ? channels
        .map(
          (c, i) =>
            `${i + 1}. ${c.title || c.username || c.id} ` +
            `(<code>${c.id}</code>)${c.username ? ' @' + c.username.replace(/^@/, '') : ''}`
        )
        .join('\n')
    : '<i>Hozircha majburiy kanal yo\'q.</i>';

  await bot.editMessageText(
    '📢 <b>Majburiy kanallar</b>\n\n' +
      list +
      '\n\nO\'chirish uchun kanal tugmasini bosing yoki yangi qo\'shing:',
    {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      ...keyboards.adminChannelsMenu(channels),
    }
  );
}

// admin:chan_add
async function promptAddChannel(bot, query) {
  if (!isAdmin(query.from.id)) {
    return bot.answerCallbackQuery(query.id, { text: '⛔ Ruxsat yo\'q.', show_alert: true });
  }
  state.set(query.from.id, { action: 'admin_add_channel' });
  await bot.answerCallbackQuery(query.id);
  await bot.sendMessage(
    query.message.chat.id,
    '➕ <b>Kanal qo\'shish</b>\n\n' +
      'Kanaldan istalgan xabarni shu yerga <b>forward</b> qiling, ' +
      'yoki kanal <code>@username</code> / raqamli <code>ID</code> sini yuboring.\n\n' +
      '⚠️ Bot tekshira olishi uchun u kanalda <b>admin</b> bo\'lishi kerak.',
    { parse_mode: 'HTML' }
  );
}

// admin:chan_del:<id>
async function deleteChannel(bot, query, channelId) {
  if (!isAdmin(query.from.id)) {
    return bot.answerCallbackQuery(query.id, { text: '⛔ Ruxsat yo\'q.', show_alert: true });
  }
  const ok = storage.removeChannel(channelId);
  await bot.answerCallbackQuery(query.id, {
    text: ok ? '🗑 O\'chirildi.' : 'Topilmadi.',
  });
  // Ro'yxatni yangilaymiz.
  await showChannels(bot, query);
}

// admin:broadcast
async function promptBroadcast(bot, query) {
  if (!isAdmin(query.from.id)) {
    return bot.answerCallbackQuery(query.id, { text: '⛔ Ruxsat yo\'q.', show_alert: true });
  }
  state.set(query.from.id, { action: 'admin_broadcast' });
  await bot.answerCallbackQuery(query.id);
  await bot.sendMessage(
    query.message.chat.id,
    '📣 <b>Broadcast</b>\n\nBarcha foydalanuvchilarga yubormoqchi bo\'lgan ' +
      'xabaringizni yuboring. Bekor qilish uchun /cancel.',
    { parse_mode: 'HTML' }
  );
}

// admin:users
async function showUsers(bot, query) {
  if (!isAdmin(query.from.id)) {
    return bot.answerCallbackQuery(query.id, { text: '⛔ Ruxsat yo\'q.', show_alert: true });
  }
  await bot.answerCallbackQuery(query.id);
  const users = storage.getUsers();
  const recent = users.slice(-30).reverse();
  const list = recent.length
    ? recent
        .map(
          (u) =>
            `• <code>${u.id}</code> ${u.first_name || ''} ` +
            `${u.username ? '@' + u.username : ''}`.trim()
        )
        .join('\n')
    : '<i>Hozircha foydalanuvchi yo\'q.</i>';

  await bot.editMessageText(
    `👥 <b>Foydalanuvchilar</b> (jami: ${users.length}, oxirgi ${recent.length} ta):\n\n` +
      list,
    {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'admin:menu' }]],
      },
    }
  );
}

// Kanal qo'shish kiritishini hal qiladi (forward yoki text).
async function resolveAndAddChannel(bot, msg) {
  const chatId = msg.chat.id;
  let target;

  if (msg.forward_from_chat && msg.forward_from_chat.type === 'channel') {
    target = msg.forward_from_chat.id;
  } else if (msg.text) {
    const t = msg.text.trim();
    target = /^-?\d+$/.test(t) ? Number(t) : t.startsWith('@') ? t : '@' + t;
  } else {
    await bot.sendMessage(chatId, '❌ Kanal aniqlanmadi. Forward qiling yoki @username yuboring.');
    return;
  }

  try {
    const chat = await bot.getChat(target);
    if (chat.type !== 'channel') {
      await bot.sendMessage(chatId, '❌ Bu kanal emas. Faqat kanal qo\'shish mumkin.');
      return;
    }
    const added = storage.addChannel({
      id: chat.id,
      title: chat.title,
      username: chat.username || null,
    });
    await bot.sendMessage(
      chatId,
      added
        ? `✅ Kanal qo'shildi: <b>${chat.title}</b> (<code>${chat.id}</code>)`
        : `ℹ️ Bu kanal allaqachon ro'yxatda: <b>${chat.title}</b>`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    await bot.sendMessage(
      chatId,
      '❌ Kanalni ololmadim. Bot kanalda <b>admin</b> ekanini va ' +
        '@username/ID to\'g\'riligini tekshiring.\n<i>Sabab:</i> ' +
        (err.response && err.response.body && err.response.body.description
          ? err.response.body.description
          : err.message),
      { parse_mode: 'HTML' }
    );
  }
}

// Broadcast yuborish.
async function runBroadcast(bot, msg) {
  const chatId = msg.chat.id;
  const users = storage.getUsers();
  let ok = 0;
  let fail = 0;

  await bot.sendMessage(chatId, `📣 Yuborish boshlandi... (${users.length} ta foydalanuvchi)`);

  for (const u of users) {
    try {
      // copyMessage — har qanday turdagi xabarni (matn/rasm/...) muallifsiz nusxalaydi.
      await bot.copyMessage(u.id, chatId, msg.message_id);
      ok++;
    } catch (_) {
      fail++;
    }
    // Telegram rate-limit (~30 msg/s) dan saqlanish uchun kichik pauza.
    await new Promise((r) => setTimeout(r, 40));
  }

  await bot.sendMessage(
    chatId,
    `✅ Broadcast tugadi.\nYuborildi: <b>${ok}</b>\nXato: <b>${fail}</b>`,
    { parse_mode: 'HTML' }
  );
}

// Admin matnli/forward kiritishini state ga qarab hal qiladi. Ishladimi — true.
async function handleAdminInput(bot, msg) {
  const userId = msg.from.id;
  if (!isAdmin(userId)) return false;
  const st = state.get(userId);
  if (!st) return false;

  if (st.action === 'admin_add_channel') {
    state.clear(userId);
    await resolveAndAddChannel(bot, msg);
    return true;
  }

  if (st.action === 'admin_broadcast') {
    state.clear(userId);
    await runBroadcast(bot, msg);
    return true;
  }

  return false;
}

module.exports = {
  showAdminMenu,
  showStats,
  showChannels,
  promptAddChannel,
  deleteChannel,
  promptBroadcast,
  showUsers,
  handleAdminInput,
};
