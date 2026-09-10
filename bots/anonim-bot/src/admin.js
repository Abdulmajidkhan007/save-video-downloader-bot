'use strict';
const { state, persist, ensureUser } = require('./state');
const util = require('./util');
const blacklist = require('./blacklist');

const isAdmin = (id) => {
  const A = process.env.ADMIN_ID;
  return !!A && String(id) === String(A);
};
const isAwaitingBroadcast = (id) => {
  const s = state.adminState.get(String(id));
  return !!(s && s.stage === 'broadcast');
};
const isAwaitingChannel = (id) => {
  const s = state.adminState.get(String(id));
  return !!(s && s.stage === 'channel');
};

// /anoner — admin panel (faqat admin uchun)
async function handleAnonerCommand(bot, msg) {
  if (!isAdmin(msg.from.id)) return;
  ensureUser(msg.from);
  state.adminState.delete(String(msg.from.id));
  await bot.sendMessage(msg.chat.id, "🛠 *Admin panel*", {
    parse_mode: 'Markdown',
    reply_markup: util.adminPanelKeyboard(),
  });
}

function statsText() {
  const users = Object.keys(state.users).length;
  const bans = Object.keys(state.bans).length;
  const channels = state.channels.length;
  const msgs = state.stats.messages || 0;
  const reps = state.stats.reports || 0;
  return (
    `📊 *Statistika*\n\n` +
    `👥 Foydalanuvchilar: *${users}*\n` +
    `✉️ Xabarlar: *${msgs}*\n` +
    `🚩 Shikoyatlar: *${reps}*\n` +
    `⛔️ Banlar: *${bans}*\n` +
    `📺 Kanallar: *${channels}*`
  );
}

async function _showOrEdit(bot, chatId, msgId, text, kb) {
  const opts = { parse_mode: 'Markdown', reply_markup: kb };
  if (msgId) {
    try { await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opts }); return; }
    catch (e) { /* eski xabar, yangi yuboramiz */ }
  }
  await bot.sendMessage(chatId, text, opts);
}

async function showUsers(bot, chatId, msgId, page) {
  const ids = Object.keys(state.users);
  const PER = 10;
  const total = ids.length;
  const pages = Math.max(1, Math.ceil(total / PER));
  const p = Math.max(0, Math.min(page, pages - 1));
  const slice = ids.slice(p * PER, (p + 1) * PER);

  let text = `👥 *Foydalanuvchilar*  (${p + 1}/${pages}, jami: ${total})\n\n`;
  if (!slice.length) text += "_Foydalanuvchi yo'q._\n";
  slice.forEach((id, i) => {
    const u = state.users[id];
    const banned = state.bans[id] ? ' ⛔️' : '';
    const flagged = blacklist.isLocal(id) ? ' 🚨' : '';
    const uname = u.username ? '@' + util.escMd(u.username) : '';
    text += `${p * PER + i + 1}. ${util.safeName(u.name) || '—'} ${uname} (id: \`${id}\`)${banned}${flagged}\n`;
  });
  if (slice.length) text += "\n💡 Batafsil ko'rish uchun raqamga bosing";

  // Raqamli tugmalar (5 tadan qatorda)
  const userBtns = slice.map((id, i) => ({
    text: String(p * PER + i + 1),
    callback_data: `a:user:${id}`,
  }));
  const btnRows = [];
  for (let i = 0; i < userBtns.length; i += 5) {
    btnRows.push(userBtns.slice(i, i + 5));
  }

  const nav = [];
  if (p > 0) nav.push({ text: '◀️', callback_data: `a:users:${p - 1}` });
  nav.push({ text: `${p + 1}/${pages}`, callback_data: 'noop' });
  if (p < pages - 1) nav.push({ text: '▶️', callback_data: `a:users:${p + 1}` });

  const rows = [...btnRows, nav, [{ text: '« Orqaga', callback_data: 'a:back' }]];
  await _showOrEdit(bot, chatId, msgId, text, { inline_keyboard: rows });
}

// Foydalanuvchi haqida batafsil ko'rinish
// Ochilganda ID avtomatik qora ro'yxatlardan (lokal + CAS + LOLS) tekshiriladi
async function showUserDetail(bot, chatId, msgId, userId) {
  const u = state.users[userId];
  if (!u) {
    return _showOrEdit(bot, chatId, msgId, "❌ Foydalanuvchi topilmadi",
      { inline_keyboard: [[{ text: '« Foydalanuvchilar', callback_data: 'a:users:0' }]] });
  }
  const link = `https://t.me/${util.getBotUsername()}?start=${u.code}`;
  const banned = !!state.bans[userId];
  const inBlacklist = blacklist.isLocal(userId);
  const blocksCount = (state.blocks[userId] || []).length;
  const joined = u.joinedAt ? u.joinedAt.split('T')[0] : '—';
  const uname = u.username ? '@' + util.escMd(u.username) : '—';

  const scamCheck = await blacklist.checkUser(userId);

  let text = `👤 *Foydalanuvchi haqida*\n\n`;
  text += `Ism: ${util.safeName(u.name) || '—'}\n`;
  text += `Username: ${uname}\n`;
  text += `ID: \`${userId}\`\n`;
  text += `Qo'shilgan: ${joined}\n`;
  text += `Bloklanganlar (uniki): ${blocksCount}\n`;
  text += `Status: ${banned ? '⛔️ Banlangan' : '✅ Faol'}\n`;
  text += `Xavfsizlik: ${blacklist.statusLine(scamCheck)}\n\n`;
  text += `🔗 *Referral havola:*\n\`${link}\``;

  const rows = [];
  rows.push([banned
    ? { text: '🔓 Bani ochish', callback_data: `a:unban:${userId}` }
    : { text: '🚫 Banlash', callback_data: `a:ban:${userId}` }]);
  rows.push([inBlacklist
    ? { text: "♻️ Blacklistdan chiqarish", callback_data: `a:unbl:${userId}` }
    : { text: '🚨 Ban + Blacklist', callback_data: `a:bl:${userId}` }]);
  rows.push([{ text: '« Foydalanuvchilar', callback_data: 'a:users:0' }]);

  await _showOrEdit(bot, chatId, msgId, text, { inline_keyboard: rows });
}

async function showBans(bot, chatId, msgId) {
  const ids = Object.keys(state.bans);
  let text = `🚫 *Banlangan foydalanuvchilar* (${ids.length})\n\n`;
  if (!ids.length) {
    text += "_Hech kim yo'q._";
  } else {
    ids.slice(0, 20).forEach((id, i) => {
      const u = state.users[id] || {};
      text += `${i + 1}. ${util.safeName(u.name) || '—'} (id: \`${id}\`)\n`;
    });
  }
  const rows = ids.slice(0, 20).map((id) => {
    const u = state.users[id] || {};
    return [{ text: `🔓 Ochish: ${util.safeName(u.name) || id}`, callback_data: `gunban:${id}` }];
  });
  rows.push([{ text: '« Orqaga', callback_data: 'a:back' }]);
  await _showOrEdit(bot, chatId, msgId, text, { inline_keyboard: rows });
}

async function showChannels(bot, chatId, msgId) {
  let text = `📺 *Kanallar* (${state.channels.length})\n\n` +
    "Foydalanuvchi botdan foydalanish uchun bularga obuna bo'lishi shart.\n\n";
  if (!state.channels.length) {
    text += "_Kanal yo'q (majburiy obuna o'chiq)._\n\n";
  } else {
    state.channels.forEach((ch, i) => {
      const uname = ch.username ? '@' + util.escMd(ch.username) : '';
      const id = ch.id ? `(id: ${ch.id})` : '';
      text += `${i + 1}. ${util.safeName(ch.title) || '—'} ${uname} ${id}\n`;
    });
  }
  const rows = state.channels.map((ch, i) => [{
    text: `🗑 ${util.safeName(ch.title) || ch.username || ch.id}`,
    callback_data: `chrm:${i}`,
  }]);
  rows.push([{ text: '➕ Yangi kanal', callback_data: 'a:ch:add' }]);
  rows.push([{ text: '« Orqaga', callback_data: 'a:back' }]);
  await _showOrEdit(bot, chatId, msgId, text, { inline_keyboard: rows });
}

// Broadcast: admin yuborgan xabarni hamma userga copy qiladi
async function handleBroadcastInput(bot, msg) {
  const adminId = String(msg.from.id);
  state.adminState.delete(adminId);
  const ids = Object.keys(state.users);
  await bot.sendMessage(msg.chat.id, `📢 Yuborilmoqda... (${ids.length} foydalanuvchi)`);
  let sent = 0, failed = 0;
  for (const id of ids) {
    try { await bot.copyMessage(id, msg.chat.id, msg.message_id); sent++; }
    catch { failed++; }
  }
  await bot.sendMessage(msg.chat.id, `✅ Yuborildi: ${sent}\n❌ Yuborilmadi: ${failed}`);
}

// Kanal qo'shish (forward yoki @username orqali)
async function handleChannelInput(bot, msg) {
  const adminId = String(msg.from.id);
  state.adminState.delete(adminId);
  let added = null;
  if (msg.forward_from_chat) {
    const c = msg.forward_from_chat;
    added = { id: c.id, title: c.title || c.username, username: c.username || null };
  } else {
    const txt = (msg.text || '').trim();
    if (txt.startsWith('@')) {
      try {
        const c = await bot.getChat(txt);
        added = { id: c.id, title: c.title || c.username, username: c.username || null };
      } catch (e) {
        return bot.sendMessage(msg.chat.id, "❌ Kanal topilmadi. Bot kanalda admin bo'lishi shart.");
      }
    } else {
      return bot.sendMessage(msg.chat.id, "❌ @username yuboring yoki kanaldan xabarni forward qiling.");
    }
  }
  if (added) {
    state.channels.push(added);
    persist.channels();
    await bot.sendMessage(msg.chat.id, `✅ Qo'shildi: ${added.title}`);
    await showChannels(bot, msg.chat.id);
  }
}

// Shikoyat → adminga yuborish
async function handleReport(bot, reporterId, senderId, sourceChatId, sourceMsgId) {
  state.stats.reports = (state.stats.reports || 0) + 1;
  persist.stats();
  const ADMIN_ID = process.env.ADMIN_ID;
  if (!ADMIN_ID) return false;

  const reporter = state.users[reporterId] || {};
  const sender = state.users[senderId] || {};
  // Jo'natuvchini qora ro'yxatlardan tekshiramiz (xato shikoyatni to'xtatmasin)
  let scamLine = '';
  try {
    const chk = await blacklist.checkUser(senderId);
    if (chk.flagged) scamLine = `\n${blacklist.statusLine(chk)}`;
  } catch {}
  const text =
    `🚩 *Shikoyat*\n\n` +
    `Shikoyatchi: ${util.safeName(reporter.name) || '—'} ` +
    `${reporter.username ? '@' + util.escMd(reporter.username) : ''} (id: \`${reporterId}\`)\n` +
    `Jo'natuvchi: ${util.safeName(sender.name) || '—'} ` +
    `${sender.username ? '@' + util.escMd(sender.username) : ''} (id: \`${senderId}\`)${scamLine}\n\n` +
    `Quyida shikoyat qilingan xabar:`;
  const kb = {
    inline_keyboard: [[
      { text: "🚫 Global Ban", callback_data: `gban:${senderId}` },
      { text: "🚨 Ban + Blacklist", callback_data: `gbl:${senderId}` },
      { text: "❌ Bekor", callback_data: `gban:no` },
    ]],
  };
  try {
    await bot.sendMessage(ADMIN_ID, text, { parse_mode: 'Markdown', reply_markup: kb });
    try { await bot.copyMessage(ADMIN_ID, sourceChatId, sourceMsgId); } catch {}
    return true;
  } catch (e) {
    console.error('report -> admin:', e.message);
    return false;
  }
}

// Admin paneli callback'lari
async function handleAdminCallback(bot, query) {
  const data = query.data;
  const fromId = String(query.from.id);
  if (!isAdmin(fromId)) {
    return bot.answerCallbackQuery(query.id, { text: "❌ Faqat admin uchun", show_alert: true });
  }
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;

  if (data === 'a:stats') {
    await _showOrEdit(bot, chatId, msgId, statsText(),
      { inline_keyboard: [[{ text: '« Orqaga', callback_data: 'a:back' }]] });
    return bot.answerCallbackQuery(query.id);
  }
  if (data.startsWith('a:users:')) {
    const p = parseInt(data.split(':')[2], 10) || 0;
    await showUsers(bot, chatId, msgId, p);
    return bot.answerCallbackQuery(query.id);
  }
  if (data.startsWith('a:user:')) {
    const userId = data.slice(7);
    await showUserDetail(bot, chatId, msgId, userId);
    return bot.answerCallbackQuery(query.id);
  }
  if (data.startsWith('a:ban:')) {
    const target = data.slice(6);
    state.bans[target] = { at: new Date().toISOString(), by: fromId };
    persist.bans();
    await bot.answerCallbackQuery(query.id, { text: "🚫 Banlandi" });
    await showUserDetail(bot, chatId, msgId, target);
    return;
  }
  if (data.startsWith('a:unban:')) {
    const target = data.slice(8);
    delete state.bans[target];
    persist.bans();
    await bot.answerCallbackQuery(query.id, { text: "🔓 Bani ochildi" });
    await showUserDetail(bot, chatId, msgId, target);
    return;
  }
  // Ban + global blacklist (bitta tugma bilan)
  if (data.startsWith('a:bl:')) {
    const target = data.slice(5);
    state.bans[target] = { at: new Date().toISOString(), by: fromId, reason: 'blacklist' };
    persist.bans();
    blacklist.addLocal(target, fromId, 'admin panel orqali');
    await bot.answerCallbackQuery(query.id, { text: "🚨 Banlandi + Blacklistga yozildi" });
    await showUserDetail(bot, chatId, msgId, target);
    return;
  }
  if (data.startsWith('a:unbl:')) {
    const target = data.slice(7);
    blacklist.removeLocal(target);
    await bot.answerCallbackQuery(query.id, { text: "♻️ Blacklistdan chiqarildi" });
    await showUserDetail(bot, chatId, msgId, target);
    return;
  }
  if (data === 'a:bc') {
    state.adminState.set(fromId, { stage: 'broadcast' });
    await _showOrEdit(bot, chatId, msgId,
      "📢 *Broadcast*\n\nYuboriladigan xabar (matn/rasm/media) ni yuboring.\n\nBekor qilish: /admin",
      { inline_keyboard: [[{ text: '« Bekor', callback_data: 'a:back' }]] });
    return bot.answerCallbackQuery(query.id);
  }
  if (data === 'a:bans') {
    await showBans(bot, chatId, msgId);
    return bot.answerCallbackQuery(query.id);
  }
  if (data === 'a:ch') {
    await showChannels(bot, chatId, msgId);
    return bot.answerCallbackQuery(query.id);
  }
  if (data === 'a:ch:add') {
    state.adminState.set(fromId, { stage: 'channel' });
    await _showOrEdit(bot, chatId, msgId,
      "📺 *Kanal qo'shish*\n\n• Kanaldan xabarni forward qiling, *yoki*\n• `@kanal_username` yuboring\n\nBot kanalda admin bo'lishi shart.",
      { inline_keyboard: [[{ text: '« Bekor', callback_data: 'a:ch' }]] });
    return bot.answerCallbackQuery(query.id);
  }
  if (data === 'a:back') {
    state.adminState.delete(fromId);
    await _showOrEdit(bot, chatId, msgId, "🛠 *Admin panel*", util.adminPanelKeyboard());
    return bot.answerCallbackQuery(query.id);
  }
  if (data.startsWith('chrm:')) {
    const i = parseInt(data.slice(5), 10);
    if (Number.isInteger(i) && i >= 0 && i < state.channels.length) {
      const removed = state.channels.splice(i, 1)[0];
      persist.channels();
      await bot.answerCallbackQuery(query.id, { text: `🗑 ${removed.title} o'chirildi` });
    } else {
      await bot.answerCallbackQuery(query.id);
    }
    await showChannels(bot, chatId, msgId);
    return;
  }
  if (data.startsWith('gban:')) {
    const target = data.slice(5);
    if (target === 'no') {
      await bot.answerCallbackQuery(query.id, { text: "Bekor qilindi" });
      try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: msgId }); } catch {}
      return;
    }
    state.bans[target] = { at: new Date().toISOString(), by: fromId };
    persist.bans();
    await bot.answerCallbackQuery(query.id, { text: "🚫 Banlandi" });
    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [[{ text: "✅ Banlandi", callback_data: 'noop' }]] },
        { chat_id: chatId, message_id: msgId }
      );
    } catch {}
    return;
  }
  // Shikoyatdan: ban + blacklist
  if (data.startsWith('gbl:')) {
    const target = data.slice(4);
    state.bans[target] = { at: new Date().toISOString(), by: fromId, reason: 'blacklist' };
    persist.bans();
    blacklist.addLocal(target, fromId, 'shikoyat orqali');
    await bot.answerCallbackQuery(query.id, { text: "🚨 Banlandi + Blacklistga yozildi" });
    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [[{ text: "🚨 Banlandi + Blacklist", callback_data: 'noop' }]] },
        { chat_id: chatId, message_id: msgId }
      );
    } catch {}
    return;
  }
  if (data.startsWith('gunban:')) {
    const target = data.slice(7);
    delete state.bans[target];
    persist.bans();
    await bot.answerCallbackQuery(query.id, { text: "🔓 Bani ochildi" });
    await showBans(bot, chatId, msgId);
    return;
  }
  // noop yoki noma'lum
  await bot.answerCallbackQuery(query.id);
}

// Kanalga obuna bo'lganda admin'ga bildirish
async function notifyChannelJoin(bot, channel, user) {
  const ADMIN_ID = process.env.ADMIN_ID;
  if (!ADMIN_ID) return;
  const chTitle = util.safeName(channel.title || '') || channel.username || channel.id;
  const fullName = [user.first_name, user.last_name].filter(Boolean).map(util.safeName).join(' ');
  const text =
    `✅ *Yangi obunachi!*\n\n` +
    `Kanal: ${chTitle}\n` +
    `Ism: ${fullName || '—'}\n` +
    `Username: ${user.username ? '@' + util.escMd(user.username) : '—'}\n` +
    `ID: \`${user.id}\``;
  try { await bot.sendMessage(ADMIN_ID, text, { parse_mode: 'Markdown' }); }
  catch (e) { console.error('notifyJoin:', e.message); }
}

// Kanaldan chiqib ketganda admin'ga bildirish
async function notifyChannelLeave(bot, channel, user) {
  const ADMIN_ID = process.env.ADMIN_ID;
  if (!ADMIN_ID) return;
  const chTitle = util.safeName(channel.title || '') || channel.username || channel.id;
  const fullName = [user.first_name, user.last_name].filter(Boolean).map(util.safeName).join(' ');
  const text =
    `❌ *Kanaldan chiqdi*\n\n` +
    `Kanal: ${chTitle}\n` +
    `Ism: ${fullName || '—'}\n` +
    `Username: ${user.username ? '@' + util.escMd(user.username) : '—'}\n` +
    `ID: \`${user.id}\``;
  try { await bot.sendMessage(ADMIN_ID, text, { parse_mode: 'Markdown' }); }
  catch (e) { console.error('notifyLeave:', e.message); }
}

// Bot o'zining statusi o'zgarganda admin'ga bildirish
async function notifyBotStatusChange(bot, chat, oldStatus, newStatus, fromUser) {
  const ADMIN_ID = process.env.ADMIN_ID;
  if (!ADMIN_ID) return;
  const isMem = (s) => ['member', 'administrator', 'creator', 'restricted'].includes(s);
  let text = null;

  if (chat.type === 'private') {
    // Private chat — foydalanuvchi botni bloklagan / qayta ochgan / o'chirgan
    const uid = String(chat.id);
    const stored = state.users[uid] || {};
    const name = stored.name
      || (fromUser ? [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') : '')
      || [chat.first_name, chat.last_name].filter(Boolean).join(' ')
      || '';
    const username = stored.username || (fromUser && fromUser.username) || chat.username || '';
    const card =
      `Ism: ${util.safeName(name) || '—'}\n` +
      `Username: ${username ? '@' + util.escMd(username) : '—'}\n` +
      `ID: \`${uid}\``;

    if (isMem(oldStatus) && !isMem(newStatus)) {
      text = `🚫 *Foydalanuvchi botni bloklagan / o'chirgan!*\n\n${card}`;
    } else if (!isMem(oldStatus) && isMem(newStatus)) {
      text = `🔓 *Foydalanuvchi botni qayta ochgan!*\n\n${card}`;
    }
  } else {
    // Kanal yoki guruh — bot statusi o'sha yerda o'zgardi
    const chTitle = util.safeName(chat.title || '') || chat.username || chat.id;
    if (!isMem(oldStatus) && newStatus === 'administrator') {
      text = `🔔 Bot *${chTitle}* kanalida admin qilindi! Endi obuna tekshiruvi ishlaydi.`;
    } else if (oldStatus === 'member' && newStatus === 'administrator') {
      text = `🔔 Bot *${chTitle}* da admin qilindi!`;
    } else if (oldStatus === 'administrator' && newStatus === 'member') {
      text = `⚠️ Bot *${chTitle}* da adminlikdan olindi. Obuna tekshiruvi to'xtaydi!`;
    } else if (isMem(oldStatus) && !isMem(newStatus)) {
      text = `⚠️ Bot *${chTitle}* dan olib tashlandi!`;
    } else if (!isMem(oldStatus) && newStatus === 'member') {
      text = `🔔 Bot *${chTitle}* ga qo'shildi (admin emas).`;
    }
  }
  if (text) {
    try { await bot.sendMessage(ADMIN_ID, text, { parse_mode: 'Markdown' }); }
    catch (e) { console.error('notifyBotStatus:', e.message); }
  }
}

module.exports = {
  isAdmin, isAwaitingBroadcast, isAwaitingChannel,
  handleAnonerCommand, handleBroadcastInput, handleChannelInput,
  handleReport, handleAdminCallback,
  notifyChannelJoin, notifyChannelLeave, notifyBotStatusChange,
};
