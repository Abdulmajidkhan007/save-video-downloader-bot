'use strict';

const fs = require('fs');
const path = require('path');
const storage = require('../services/storage');
const { isAdmin, config } = require('../config');
const { runBroadcast } = require('../services/broadcast');
const ratelimit = require('../services/ratelimit');
const adminlog = require('../services/adminlog');
const notify = require('../services/notify');
const {
  adminMenuKeyboard,
  adminGroupsListKeyboard,
  groupMembersNavKeyboard,
  adminChannelsKeyboard,
  broadcastTargetKeyboard,
  broadcastModeKeyboard,
  backToMenuKeyboard,
} = require('../utils/keyboard');

const GROUP_MEMBERS_PER_PAGE = 30;
const GROUP_MEMBERS_TXT_THRESHOLD = 100;

// Admin uchun ko'p qadamli holat (state machine).
// userId -> { action: 'add_channel' | 'broadcast' | 'search_user', mode?: 'copy'|'forward' }
const adminState = new Map();

// Admin holatda ekanligini boshqa handlerlar tekshirishi uchun.
function isAwaitingInput(userId) {
  return adminState.has(String(userId));
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(
    /[&<>]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])
  );
}

function adminInfo(from) {
  return {
    id: from.id,
    name: from.first_name || (from.username ? '@' + from.username : String(from.id)),
  };
}

// ---- /admin buyrug'i -----------------------------------------------------

async function handleAdminCommand(bot, msg) {
  if (!isAdmin(msg.from.id)) {
    // Ruxsatsiz urinish — adminlarga ogohlantirish yuboramiz.
    notify.notifyAdmins(
      '⚠️ <b>Ruxsatsiz admin urinish</b>\n' +
        `👤 ${escapeHtml(msg.from.first_name || '')} ` +
        `${msg.from.username ? '@' + escapeHtml(msg.from.username) : ''}\n` +
        `🆔 <code>${msg.from.id}</code>`
    );
    await bot.sendMessage(
      msg.chat.id,
      '⚠️ Bu komanda faqat adminlar uchun.\n\n' +
        '💬 Admin bilan bog\'lanmoqchimisiz? /boglanish komandasidan foydalaning.',
      {
        reply_markup: {
          inline_keyboard: [[{ text: '💬 Bog\'lanish', callback_data: 'contact_start' }]],
        },
      }
    );
    return;
  }
  await bot.sendMessage(msg.chat.id, '🛠 <b>Admin panel</b>', {
    parse_mode: 'HTML',
    reply_markup: adminMenuKeyboard(storage.getSettings().autoForward),
  });
}

// ---- Statistika matni ----------------------------------------------------

function buildStatsText() {
  const stats = storage.getStats();
  const totalUsers = storage.getUserCount();
  const privateUsers = storage.getPrivateCount();
  const groupSeen = storage.getGroupSeenCount();
  const activeToday = storage.getActiveTodayCount();
  const groupCount = storage.getGroupCount();
  const today = new Date().toISOString().slice(0, 10);
  const todayDownloads = (stats.daily && stats.daily[today]) || 0;

  const byPlatform = stats.byPlatform || {};
  const platLines = Object.keys(byPlatform).length
    ? Object.entries(byPlatform)
        .sort((a, b) => b[1] - a[1])
        .map(([p, n]) => `   • ${p}: ${n}`)
        .join('\n')
    : '   • (hali yo\'q)';

  return (
    '📊 <b>Statistika</b>\n\n' +
    `👥 Jami foydalanuvchilar: <b>${totalUsers}</b>\n` +
    `   • private (/start): <b>${privateUsers}</b>\n` +
    `   • guruh orqali ko'rilgan: <b>${groupSeen}</b>\n` +
    `👥 Guruhlar: <b>${groupCount}</b>\n` +
    `🟢 Bugungi faollar: <b>${activeToday}</b>\n` +
    `📥 Jami yuklashlar: <b>${stats.totalDownloads || 0}</b>\n` +
    `📆 Bugungi yuklashlar: <b>${todayDownloads}</b>\n` +
    `🎵 MP3 yuklashlar: <b>${stats.mp3Downloads || 0}</b>\n` +
    `🔎 Musiqa qidiruvlar: <b>${stats.musicSearches || 0}</b>\n` +
    `🔗 Referral orqali kelganlar: <b>${storage.getReferredCount()}</b>\n\n` +
    '📌 <b>Platforma bo\'yicha:</b>\n' +
    platLines
  );
}

// Referral reyting — top 10 (points bo'yicha).
function buildReferralText() {
  const top = storage.getReferralLeaderboard(10);
  if (!top.length) return '🏆 <b>Referral reyting</b>\n\nHali ball to\'plagan yo\'q.';
  const lines = top.map((u, i) => {
    const uname = u.username ? '@' + escapeHtml(u.username) : '(username yo\'q)';
    const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
    return `${medal} ${escapeHtml(u.firstName || '-')} ${uname} — ⭐️ ${u.points || 0} (${u.referrals || 0} ta)`;
  });
  return '🏆 <b>Referral reyting (top 10)</b>\n\n' + lines.join('\n');
}

// Bitta foydalanuvchining to'liq kartasi.
function buildUserCard(u) {
  const uname = u.username ? '@' + escapeHtml(u.username) : '(username yo\'q)';
  const hist =
    u.usernameHistory && u.usernameHistory.length
      ? u.usernameHistory.map((h) => '@' + escapeHtml(h)).join(', ')
      : '—';
  const byPlat =
    u.downloadsByPlatform && Object.keys(u.downloadsByPlatform).length
      ? Object.entries(u.downloadsByPlatform)
          .map(([p, n]) => `${p}: ${n}`)
          .join(', ')
      : '—';
  return (
    '👤 <b>Foydalanuvchi kartasi</b>\n\n' +
    `Ism: ${escapeHtml(u.firstName || '-')}\n` +
    `Username: ${uname}\n` +
    `Username tarixi: ${hist}\n` +
    `🆔 ID: <code>${u.id}</code>\n` +
    `🔗 <a href="tg://user?id=${u.id}">Profilga o'tish</a>\n` +
    `Til: ${escapeHtml(u.languageCode || '-')}\n` +
    `Premium: ${u.isPremium ? 'ha' : "yo'q"}\n` +
    `Manba: ${escapeHtml(u.source || '-')}\n` +
    `Bloklagan: ${u.blocked ? 'ha' : "yo'q"}\n` +
    `Birinchi ko'rilgan: ${(u.firstSeen || u.joinedAt || '-').slice(0, 19).replace('T', ' ')}\n` +
    `Oxirgi faollik: ${(u.lastActive || '-').slice(0, 19).replace('T', ' ')}\n` +
    `📥 Yuklashlar: <b>${u.downloads || 0}</b>\n` +
    `   platforma bo'yicha: ${byPlat}`
  );
}

function buildLimitsText() {
  const hits = ratelimit.getRecentLimitHits();
  if (!hits.length) return '🚦 <b>Limitga urilganlar (24s)</b>\n\nHech kim yo\'q.';
  const lines = hits.slice(0, 20).map((h, i) => {
    const uname = h.username ? '@' + escapeHtml(h.username) : '';
    const when = new Date(h.lastHit).toISOString().slice(11, 19);
    return `${i + 1}. ${escapeHtml(h.firstName || '-')} ${uname}\n    ID: <code>${h.id}</code> · ${h.count} marta · oxirgi ${when}`;
  });
  return '🚦 <b>So\'nggi 24 soatda limitga urilganlar</b>\n\n' + lines.join('\n');
}

function buildLogsText() {
  const logs = adminlog.getRecent(10);
  if (!logs.length) return '🧾 <b>Admin loglar</b>\n\nHali yozuv yo\'q.';
  const lines = logs.map((l) => {
    const when = (l.at || '').slice(0, 19).replace('T', ' ');
    return `• ${when} — <b>${escapeHtml(l.action)}</b>\n   ${escapeHtml(l.adminName)}: ${escapeHtml(l.detail)}`;
  });
  return '🧾 <b>Admin loglar (oxirgi 10)</b>\n\n' + lines.join('\n');
}

function buildGroupsText() {
  const groups = storage.getGroups();
  const entries = Object.entries(groups);
  if (!entries.length) return '👥 <b>Guruhlar</b>\n\nHali guruh yo\'q.';
  return `👥 <b>Guruhlar</b> (${entries.length})\n\nBatafsil ko'rish uchun tanlang:`;
}

function fmtDate(iso) {
  return (iso || '-').slice(0, 19).replace('T', ' ');
}

// Guruh a'zosining bitta qatori (inline uchun, HTML).
function memberLine(m, idx) {
  const uname = m.username ? '@' + escapeHtml(m.username) : '';
  const last = m.lastSeen ? m.lastSeen.slice(0, 10) : '-';
  return `${idx}. ${escapeHtml(m.firstName || '-')} ${uname}\n    ID: <code>${m.id}</code> · oxirgi: ${last}`;
}

// Guruh kartasi (header) matnini quradi.
function buildGroupCardHeader(groupId, group, realCount, seenCount) {
  return (
    `👥 <b>${escapeHtml(group.title || '(nomsiz)')}</b>\n` +
    `🆔 <code>${groupId}</code>\n` +
    `📊 Jami a'zolar: <b>${realCount}</b>\n` +
    `👁 Ko'rilgan a'zolar: <b>${seenCount}/${realCount}</b>\n` +
    `👤 Qo'shdi: ${escapeHtml(group.addedByName || '-')}\n` +
    `📅 Qo'shilgan: ${fmtDate(group.addedAt)}\n\n` +
    'ℹ️ <i>Telegram to\'liq a\'zolar ro\'yxatini bermaydi — bu faqat bot ' +
    'ko\'rgan (yozgan/qo\'shilgan) faol a\'zolar.</i>'
  );
}

// .txt fayl matnini quradi (>100 a'zo uchun).
function buildMembersTxt(groupId, group, realCount, seen) {
  const line = '═══════════════════════════════════';
  const dash = '───────────────────────────────────';
  let out = '';
  out += line + '\n';
  out += "  GURUH MA'LUMOTLARI\n";
  out += line + '\n';
  out += `Nomi:        ${group.title || '(nomsiz)'}\n`;
  out += `ID:          ${groupId}\n`;
  out += `Jami a'zolar: ${realCount}\n`;
  out += `Bot ko'rgan: ${seen.length}\n`;
  out += `Sana:        ${fmtDate(new Date().toISOString())}\n`;
  out += dash + '\n';
  out += "  FAOL A'ZOLAR RO'YXATI\n";
  out += dash + '\n';
  seen.forEach((m, i) => {
    const uname = m.username ? '@' + m.username : '';
    out += `${i + 1}.  ${m.firstName || '-'}  ${uname}  (ID: ${m.id})  — oxirgi: ${fmtDate(m.lastSeen)}\n`;
  });
  out += line + '\n';
  out += "Eslatma: Bu ro'yxat bot ko'rgan faol\n";
  out += "a'zolardan iborat, to'liq emas.\n";
  return out;
}

// Guruh kartasini ko'rsatadi. Ko'rilgan a'zolar soniga qarab:
//  <=30 inline; 30-100 sahifalab; >100 .txt fayl.
async function showGroupCard(bot, adminChatId, messageId, groupId, page) {
  const group = storage.getGroup(groupId);
  if (!group) {
    await bot.editMessageText('⚠️ Guruh topilmadi.', {
      chat_id: adminChatId,
      message_id: messageId,
      reply_markup: backToMenuKeyboard(),
    });
    return;
  }

  let realCount = '?';
  try {
    realCount = await bot.getChatMemberCount(groupId);
  } catch (_) {
    /* bot guruhda bo'lmasligi mumkin */
  }

  const seen = storage.getSeenMembers(groupId);
  const header = buildGroupCardHeader(groupId, group, realCount, seen.length);

  const editText = (text, keyboard) =>
    bot.editMessageText(text, {
      chat_id: adminChatId,
      message_id: messageId,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: keyboard,
    });

  if (seen.length === 0) {
    await editText(header + '\n\n👁 Hali ko\'rilgan a\'zo yo\'q.', {
      inline_keyboard: [[{ text: '⬅️ Guruhlar', callback_data: 'admin|groups' }]],
    });
    return;
  }

  // >100 — .txt fayl qilib yuboramiz
  if (seen.length > GROUP_MEMBERS_TXT_THRESHOLD) {
    await editText(
      header + `\n\n📄 ${seen.length} ta a'zo — ro'yxat .txt faylda yuborildi.`,
      { inline_keyboard: [[{ text: '⬅️ Guruhlar', callback_data: 'admin|groups' }]] }
    );
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `guruh_${groupId}_${dateStr}.txt`;
    const filePath = path.join(config.DOWNLOADS_DIR, fileName);
    try {
      if (!fs.existsSync(config.DOWNLOADS_DIR)) fs.mkdirSync(config.DOWNLOADS_DIR, { recursive: true });
      fs.writeFileSync(filePath, buildMembersTxt(groupId, group, realCount, seen), 'utf8');
      await bot.sendDocument(adminChatId, filePath, {}, { filename: fileName, contentType: 'text/plain' });
    } catch (err) {
      console.error('[group txt] xato:', err.message);
      await bot.sendMessage(adminChatId, '❌ Faylni yuborib bo\'lmadi.');
    } finally {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {
        /* ignore */
      }
    }
    return;
  }

  // 30 dan kam — hammasini inline; 30-100 — sahifalab (30 tadan)
  if (seen.length <= GROUP_MEMBERS_PER_PAGE) {
    const lines = seen.map((m, i) => memberLine(m, i + 1)).join('\n');
    await editText(header + '\n\n' + lines, {
      inline_keyboard: [[{ text: '⬅️ Guruhlar', callback_data: 'admin|groups' }]],
    });
    return;
  }

  const totalPages = Math.ceil(seen.length / GROUP_MEMBERS_PER_PAGE);
  const p = Math.min(Math.max(0, page || 0), totalPages - 1);
  const start = p * GROUP_MEMBERS_PER_PAGE;
  const pageItems = seen.slice(start, start + GROUP_MEMBERS_PER_PAGE);
  const lines = pageItems.map((m, i) => memberLine(m, start + i + 1)).join('\n');
  await editText(header + '\n\n' + lines, groupMembersNavKeyboard(groupId, p, totalPages));
}

function buildUsersText() {
  const recent = storage.getRecentUsers(10);
  if (!recent.length) return '👥 Hali foydalanuvchilar yo\'q.';
  const lines = recent.map((u, i) => {
    const uname = u.username ? `@${u.username}` : '(username yo\'q)';
    const joined = u.joinedAt ? u.joinedAt.slice(0, 10) : '-';
    return `${i + 1}. ${u.firstName || '-'} ${uname}\n    ID: <code>${u.id}</code> · ${joined} · 📥${u.downloads || 0}`;
  });
  return '👥 <b>Oxirgi 10 foydalanuvchi</b>\n\n' + lines.join('\n');
}

function buildChannelsText() {
  const channels = storage.getChannels();
  if (!channels.length) {
    return (
      '📣 <b>Majburiy obuna kanallari</b>\n\n' +
      'Hozircha kanal qo\'shilmagan.\n\n' +
      'ℹ️ Kanal qo\'shish uchun bot o\'sha kanalda <b>admin</b> bo\'lishi shart.'
    );
  }
  const lines = channels.map((c, i) => {
    const uname = c.username ? `@${c.username}` : c.id;
    return `${i + 1}. ${c.title || uname} (${uname})`;
  });
  return (
    '📣 <b>Majburiy obuna kanallari</b>\n\n' +
    lines.join('\n') +
    '\n\nO\'chirish uchun kanal tugmasini bosing.'
  );
}

// ---- Callback query (admin|...) -----------------------------------------

async function handleAdminCallback(bot, query) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  if (!isAdmin(userId)) {
    await bot.answerCallbackQuery(query.id, { text: '⛔️ Ruxsat yo\'q', show_alert: true });
    return;
  }

  const parts = query.data.split('|');
  const action = parts[1];

  const editMenu = async (text, keyboard) => {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (_) {
      await bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    }
  };

  await bot.answerCallbackQuery(query.id).catch(() => {});

  switch (action) {
    case 'menu':
      adminState.delete(String(userId));
      await editMenu('🛠 <b>Admin panel</b>', adminMenuKeyboard(storage.getSettings().autoForward));
      break;

    case 'autofwd': {
      const next = !storage.getSettings().autoForward;
      storage.setSetting('autoForward', next);
      adminlog.log(
        'autoforward_toggle',
        adminInfo(query.from),
        `avto-tarqatish: ${next ? 'yoniq' : "o'chiq"}`
      );
      await editMenu(
        `🛠 <b>Admin panel</b>\n\n📡 Avto-tarqatish ${next ? 'yoqildi ✅' : "o'chirildi ❌"}`,
        adminMenuKeyboard(next)
      );
      break;
    }

    case 'stats':
      await editMenu(buildStatsText(), backToMenuKeyboard());
      break;

    case 'users':
      await editMenu(buildUsersText(), backToMenuKeyboard());
      break;

    case 'groups':
      await editMenu(buildGroupsText(), adminGroupsListKeyboard(storage.getGroups()));
      break;

    case 'group':
      await showGroupCard(bot, chatId, messageId, parts[2], 0);
      break;

    case 'gmpage':
      await showGroupCard(bot, chatId, messageId, parts[2], parseInt(parts[3], 10) || 0);
      break;

    case 'referrals':
      await editMenu(buildReferralText(), backToMenuKeyboard());
      break;

    case 'limits':
      await editMenu(buildLimitsText(), backToMenuKeyboard());
      break;

    case 'logs':
      await editMenu(buildLogsText(), backToMenuKeyboard());
      break;

    case 'finduser':
      adminState.set(String(userId), { action: 'search_user' });
      await editMenu(
        '👤 <b>User qidirish</b>\n\n' +
          'Foydalanuvchi <b>ID</b> raqamini yoki <b>@username</b> ini yuboring.\n\n' +
          'Bekor qilish: /admin',
        backToMenuKeyboard()
      );
      break;

    case 'channels':
      await editMenu(buildChannelsText(), adminChannelsKeyboard(storage.getChannels()));
      break;

    case 'addchan':
      adminState.set(String(userId), { action: 'add_channel' });
      await editMenu(
        '➕ <b>Kanal qo\'shish</b>\n\n' +
          'Kanaldan biror postni shu yerga <b>forward</b> qiling ' +
          'yoki kanal <b>@username</b> ini yuboring.\n\n' +
          '⚠️ Bot o\'sha kanalda <b>admin</b> bo\'lishi shart!\n\n' +
          'Bekor qilish: /admin',
        backToMenuKeyboard()
      );
      break;

    case 'delchan': {
      const id = parts.slice(2).join('|');
      const removed = storage.removeChannel(id);
      if (removed) {
        adminlog.log('channel_remove', adminInfo(query.from), `kanal: ${id}`);
      }
      const note = removed ? '✅ Kanal o\'chirildi.' : '⚠️ Kanal topilmadi.';
      await editMenu(
        note + '\n\n' + buildChannelsText(),
        adminChannelsKeyboard(storage.getChannels())
      );
      break;
    }

    case 'broadcast':
      await editMenu(
        '📢 <b>Broadcast</b>\n\nKimga yuborilsin?',
        broadcastTargetKeyboard()
      );
      break;

    case 'bc_target': {
      const target = ['users', 'groups', 'all'].includes(parts[2]) ? parts[2] : 'users';
      const label =
        target === 'users' ? 'faqat userlar' : target === 'groups' ? 'faqat guruhlar' : 'hammasi';
      await editMenu(
        `📢 <b>Broadcast — ${label}</b>\n\nYuborish rejimini tanlang:`,
        broadcastModeKeyboard(target)
      );
      break;
    }

    case 'bc_copy':
    case 'bc_forward': {
      const mode = action === 'bc_copy' ? 'copy' : 'forward';
      const target = ['users', 'groups', 'all'].includes(parts[2]) ? parts[2] : 'users';
      adminState.set(String(userId), { action: 'broadcast', mode, target });
      await editMenu(
        `📢 <b>Broadcast (${mode === 'copy' ? 'nusxa' : 'forward'})</b>\n\n` +
          'Yubormoqchi bo\'lgan xabarni (matn/rasm/video) shu yerga yuboring.\n\n' +
          'Bekor qilish: /admin',
        backToMenuKeyboard()
      );
      break;
    }

    default:
      break;
  }
}

// ---- Admin matnli javoblari (holatga qarab) ------------------------------

// Agar admin biror qadam kutayotgan bo'lsa — matnni shu yerda ushlaymiz.
// true qaytarsa, xabar boshqa handlerlarga o'tmaydi.
async function handleAdminInput(bot, msg) {
  const userId = String(msg.from.id);
  if (!isAdmin(userId)) return false;
  const state = adminState.get(userId);
  if (!state) return false;

  const chatId = msg.chat.id;

  // Kanal qo'shish
  if (state.action === 'add_channel') {
    adminState.delete(userId);
    await addChannelFromMessage(bot, msg);
    return true;
  }

  // User qidirish
  if (state.action === 'search_user') {
    adminState.delete(userId);
    const found = storage.findUser(msg.text || '');
    if (!found) {
      await bot.sendMessage(
        chatId,
        '❌ Foydalanuvchi topilmadi. ID yoki @username to\'g\'riligini tekshiring.',
        { reply_markup: backToMenuKeyboard() }
      );
      return true;
    }
    await bot.sendMessage(chatId, buildUserCard(found), {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: backToMenuKeyboard(),
    });
    return true;
  }

  // Broadcast
  if (state.action === 'broadcast') {
    adminState.delete(userId);
    const target = state.target || 'users';
    const targetLabel =
      target === 'users' ? 'userlar' : target === 'groups' ? 'guruhlar' : 'hammasi';
    await bot.sendMessage(chatId, `📤 Broadcast boshlandi (${targetLabel})...`);
    const progressMsg = await bot.sendMessage(chatId, '0 yuborildi...');

    const result = await runBroadcast(bot, {
      mode: state.mode,
      target,
      source: { chatId, messageId: msg.message_id },
      onProgress: async (done, total) => {
        try {
          await bot.editMessageText(`⏳ ${done}/${total} yuborildi...`, {
            chat_id: chatId,
            message_id: progressMsg.message_id,
          });
        } catch (_) {
          /* ignore */
        }
      },
    });

    adminlog.log(
      'broadcast',
      adminInfo(msg.from),
      `mode=${state.mode} target=${target} ` +
        `users(${result.userSent}/${result.userTotal},blok=${result.userBlocked}) ` +
        `groups(${result.groupSent}/${result.groupTotal},chiqib=${result.groupFailed})`
    );

    let report = '✅ <b>Broadcast yakunlandi</b>\n';
    if (target === 'users' || target === 'all') {
      report +=
        '\n👤 <b>Userlar</b>\n' +
        `📨 Jami private: ${result.userTotal}\n` +
        `✅ Yuborildi: ${result.userSent}\n` +
        `🚫 Bloklagan: ${result.userBlocked}` +
        (result.userFailed ? `\n⚠️ Boshqa xato: ${result.userFailed}` : '');
    }
    if (target === 'groups' || target === 'all') {
      report +=
        '\n\n👥 <b>Guruhlar</b>\n' +
        `📨 Jami: ${result.groupTotal}\n` +
        `✅ Yuborildi: ${result.groupSent}\n` +
        `🚪 Chiqarilgan/xato (o'tkazildi): ${result.groupFailed}`;
    }

    await bot.sendMessage(chatId, report, { parse_mode: 'HTML' });
    return true;
  }

  return false;
}

// Forward qilingan post yoki @username orqali kanal qo'shish.
async function addChannelFromMessage(bot, msg) {
  const chatId = msg.chat.id;
  let target = null; // getChat uchun identifikator

  if (msg.forward_from_chat && msg.forward_from_chat.type === 'channel') {
    target = msg.forward_from_chat.id;
  } else if (msg.text) {
    const m = msg.text.trim().match(/^@?([A-Za-z0-9_]{4,})$/);
    if (m) target = `@${m[1]}`;
  }

  if (!target) {
    await bot.sendMessage(
      chatId,
      '⚠️ Kanalni aniqlab bo\'lmadi. Kanaldan post forward qiling yoki ' +
        '@username yuboring.'
    );
    return;
  }

  try {
    // Bot kanalda admin ekanini tekshiramiz
    const chat = await bot.getChat(target);
    const me = await bot.getMe();
    const botMember = await bot.getChatMember(chat.id, me.id);
    if (!['administrator', 'creator'].includes(botMember.status)) {
      await bot.sendMessage(
        chatId,
        `⚠️ Bot «${chat.title}» kanalida admin emas. Avval botni kanalga ` +
          'admin qilib qo\'shing, keyin qayta urinib ko\'ring.'
      );
      return;
    }

    const added = storage.addChannel({
      id: chat.id,
      title: chat.title || '',
      username: chat.username || '',
    });
    if (added) {
      adminlog.log(
        'channel_add',
        adminInfo(msg.from),
        `kanal: ${chat.title || ''} (${chat.username ? '@' + chat.username : chat.id})`
      );
      await bot.sendMessage(chatId, `✅ «${chat.title}» kanali qo\'shildi.`, {
        reply_markup: adminChannelsKeyboard(storage.getChannels()),
      });
    } else {
      await bot.sendMessage(chatId, 'ℹ️ Bu kanal allaqachon ro\'yxatda bor.');
    }
  } catch (err) {
    console.error('[admin] kanal qo\'shishda xato:', err.message);
    await bot.sendMessage(
      chatId,
      '❌ Kanalni topib bo\'lmadi yoki bot unga kira olmadi. ' +
        'Bot kanalda admin ekanini tekshiring.'
    );
  }
}

module.exports = {
  handleAdminCommand,
  handleAdminCallback,
  handleAdminInput,
  isAwaitingInput,
};
