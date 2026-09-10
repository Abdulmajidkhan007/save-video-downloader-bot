// ============================================================
//  GURUH TESTLARI (2-bosqich)
//  Oqim:
//   1) Bot guruhga qo'shiladi + admin qilinadi (my_chat_member orqali aniqlanadi)
//   2) Egasi shaxsiy chatda: guruh -> yo'nalish -> bo'lim -> savol soni -> vaqt -> jadval
//   3) Guruhga e'lon + "Men ham qatnashaman" tugmasi
//   4) Belgilangan vaqtda taymerli quiz poll'lar (hamma uchun bir xil vaqt)
//   5) Yakunda guruhda reyting + egasiga to'liq natija + shaxsiy statistika
//
//  Eslatma: ball sanaladigan test FAQAT guruhda ishlaydi (kanalda poll anonim).
//  Rejalashtirish xotirada — bot qayta ishga tushsa, kutilayotgan test bekor bo'ladi.
// ============================================================
const storage = require('./storage');
const questions = require('./questions');
const { COUNT_OPTIONS, TIME_OPTIONS } = require('../config');

let BOT_ID = null;
function setBotId(id) { BOT_ID = id; }

const setups = {};          // hostId -> { groupId, title, dir, sub, label, count, seconds }
const groupSessions = {};   // groupId -> session
const pollToGroup = {};     // poll_id -> { groupId, qIndex, correct }

const SCHEDULE_OPTIONS = [
  { key: 'now', label: '\u25B6\uFE0F Hoziroq', delayMs: 20 * 1000 },
  { key: '5',   label: '5 daqiqa',  delayMs: 5 * 60 * 1000 },
  { key: '15',  label: '15 daqiqa', delayMs: 15 * 60 * 1000 },
  { key: '30',  label: '30 daqiqa', delayMs: 30 * 60 * 1000 },
  { key: '60',  label: '1 soat',    delayMs: 60 * 60 * 1000 }
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function prepareQuestion(q) {
  const opts = (q.options || []).map((opt, i) => ({ opt, correct: i === q.correct }));
  const sh = shuffle(opts);
  return { text: q.q || q.question || '', options: sh.map(x => x.opt), correct: sh.findIndex(x => x.correct) };
}
function fullName(user) {
  const n = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return n || user.username || ('User ' + user.id);
}
function delayText(ms) {
  if (ms < 60000) return Math.round(ms / 1000) + ' soniyadan keyin';
  return Math.round(ms / 60000) + ' daqiqadan keyin';
}
function editTo(bot, chatId, messageId, text, rows) {
  bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: rows } })
    .catch(() => bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: rows } }));
}

// ---------------- my_chat_member: guruhlarni ro'yxatga olish ----------------
function handleMyChatMember(bot, update) {
  const chat = update.chat;
  if (!chat || (chat.type !== 'group' && chat.type !== 'supergroup')) return;
  const status = update.new_chat_member && update.new_chat_member.status;
  if (status === 'administrator' || status === 'member') {
    storage.upsertGroup({ id: chat.id, title: chat.title || 'Guruh', type: chat.type });
  } else if (status === 'left' || status === 'kicked') {
    storage.removeGroup(chat.id);
  }
}

// ---------------- Egasi: hosting menyusi ----------------
function startHosting(bot, chatId, hostId) {
  const list = Object.values(storage.getGroups());
  if (!list.length) {
    bot.sendMessage(chatId,
      "\uD83D\uDC65 Guruhda test o'tkazish uchun:\n\n" +
      "1\uFE0F\u20E3 Botni guruhingizga qo'shing\n" +
      "2\uFE0F\u20E3 Botni guruhda ADMIN qiling\n" +
      "3\uFE0F\u20E3 So'ng shu tugmani qayta bosing\n\n" +
      "Bot admin bo'lgach, guruh shu yerda paydo bo'ladi.");
    return;
  }
  const rows = list.map(g => [{ text: '\uD83D\uDC65 ' + g.title, callback_data: 'ggrp:' + g.id }]);
  bot.sendMessage(chatId, "\uD83D\uDC65 Qaysi guruhda test o'tkazamiz?", { reply_markup: { inline_keyboard: rows } });
}

// ---------------- Bosqich ekranlari (orqaga tugmali) ----------------
function renderGroupList(bot, chatId, messageId) {
  const list = Object.values(storage.getGroups());
  if (!list.length) { editTo(bot, chatId, messageId, "Guruh topilmadi. Botni guruhga admin qiling.", []); return; }
  const rows = list.map(g => [{ text: '👥 ' + g.title, callback_data: 'ggrp:' + g.id }]);
  editTo(bot, chatId, messageId, "👥 Qaysi guruhda test o'tkazamiz?", rows);
}
function renderDirections(bot, chatId, messageId) {
  const rows = questions.getDirections().map(d => [{ text: d.emoji + ' ' + d.label, callback_data: 'gdir:' + d.key }]);
  rows.push([{ text: '⬅️ Orqaga', callback_data: 'gb:grp' }]);
  editTo(bot, chatId, messageId, "🧭 Yo'nalishni tanlang:", rows);
}
function renderSubs(bot, chatId, messageId, s) {
  const rows = questions.getSubs(s.dir).map(x => [{ text: x.label + ' (' + x.count + ')', callback_data: 'gsub:' + x.key }]);
  rows.push([{ text: '⬅️ Orqaga', callback_data: 'gb:dir' }]);
  editTo(bot, chatId, messageId, "📚 Bo'limni tanlang:", rows);
}
function renderCount(bot, chatId, messageId) {
  const rows = [COUNT_OPTIONS.map(c => ({ text: c + ' ta', callback_data: 'gcnt:' + c }))];
  rows.push([{ text: '⬅️ Orqaga', callback_data: 'gb:sub' }]);
  editTo(bot, chatId, messageId, "🔢 Nechta savol?", rows);
}
function renderTime(bot, chatId, messageId) {
  const rows = [TIME_OPTIONS.map(t => ({ text: t + 's', callback_data: 'gtm:' + t }))];
  rows.push([{ text: '⬅️ Orqaga', callback_data: 'gb:cnt' }]);
  editTo(bot, chatId, messageId, "⏱ Har savolga necha soniya?", rows);
}
function renderSchedule(bot, chatId, messageId) {
  const rows = [SCHEDULE_OPTIONS.map(o => ({ text: o.label, callback_data: 'gsch:' + o.key }))];
  rows.push([{ text: '⬅️ Orqaga', callback_data: 'gb:tm' }]);
  editTo(bot, chatId, messageId, "🕐 Test qachon boshlansin?", rows);
}

// ---------------- Callbacklarni boshqarish ----------------
// true qaytarsa — bu yerda ishlangan; false — boshqa joyga tegishli (Stage 1)
async function handleCallback(bot, query) {
  const data = query.data || '';
  const p = data.split(':');

  if (p[0] === 'gjoin') return handleJoin(bot, query, p[1]);
  if (!['ggrp', 'gdir', 'gsub', 'gcnt', 'gtm', 'gsch', 'gb'].includes(p[0])) return false;

  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const hostId = query.from.id;
  await bot.answerCallbackQuery(query.id).catch(() => {});

  if (p[0] === 'ggrp') {
    const groupId = Number(p[1]);
    try {
      const hostM = await bot.getChatMember(groupId, hostId);
      if (!['administrator', 'creator'].includes(hostM.status)) {
        editTo(bot, chatId, messageId, "\u26A0\uFE0F Siz bu guruhda admin emassiz. Faqat guruh adminlari test o'tkaza oladi.", []);
        return true;
      }
      if (BOT_ID) {
        const botM = await bot.getChatMember(groupId, BOT_ID);
        if (botM.status !== 'administrator') {
          editTo(bot, chatId, messageId, "\u26A0\uFE0F Bot bu guruhda admin emas. Avval botni admin qiling.", []);
          return true;
        }
      }
    } catch (e) {
      editTo(bot, chatId, messageId, "\u26A0\uFE0F Guruhni tekshirib bo'lmadi: " + e.message, []);
      return true;
    }
    const groups = storage.getGroups();
    setups[hostId] = { groupId, title: (groups[groupId] && groups[groupId].title) || 'Guruh' };
    renderDirections(bot, chatId, messageId);
    return true;
  }

  // Guruhlar ro'yxatiga qaytish (setup shart emas)
  if (p[0] === 'gb' && p[1] === 'grp') { renderGroupList(bot, chatId, messageId); return true; }

  const s = setups[hostId];
  if (!s) { bot.sendMessage(chatId, "Sozlash bekor bo'ldi. \"\uD83D\uDC65 Guruhda test\" ni qayta bosing."); return true; }

  if (p[0] === 'gdir') { s.dir = p[1]; renderSubs(bot, chatId, messageId, s); return true; }
  if (p[0] === 'gsub') { s.sub = p[1]; s.label = questions.getSubLabel(s.dir, s.sub); renderCount(bot, chatId, messageId); return true; }
  if (p[0] === 'gcnt') { s.count = parseInt(p[1], 10); renderTime(bot, chatId, messageId); return true; }
  if (p[0] === 'gtm') { s.seconds = parseInt(p[1], 10); renderSchedule(bot, chatId, messageId); return true; }
  if (p[0] === 'gsch') {
    const opt = SCHEDULE_OPTIONS.find(o => o.key === p[1]) || SCHEDULE_OPTIONS[0];
    bot.deleteMessage(chatId, messageId).catch(() => {});
    scheduleTest(bot, hostId, chatId, opt.delayMs);
    return true;
  }

  // Orqaga qaytish
  if (p[0] === 'gb') {
    if (p[1] === 'dir') { renderDirections(bot, chatId, messageId); return true; }
    if (p[1] === 'sub') { renderSubs(bot, chatId, messageId, s); return true; }
    if (p[1] === 'cnt') { renderCount(bot, chatId, messageId); return true; }
    if (p[1] === 'tm') { renderTime(bot, chatId, messageId); return true; }
  }
  return true;
}

// ---------------- Rejalashtirish + guruhga e'lon ----------------
function scheduleTest(bot, hostId, hostChatId, delayMs) {
  const s = setups[hostId];
  if (!s) return;
  const bank = questions.getQuestions(s.dir, s.sub);
  if (!bank.length) { bot.sendMessage(hostChatId, "\u26A0\uFE0F Bu bo'limda savol yo'q."); return; }

  const n = Math.min(s.count, bank.length);
  const list = shuffle(bank).slice(0, n).map(prepareQuestion);
  const startAt = Date.now() + delayMs;

  const session = {
    groupId: s.groupId, title: s.title, hostId, hostChatId,
    dir: s.dir, sub: s.sub, label: s.label,
    list, count: n, seconds: s.seconds, startAt,
    participants: {}, index: 0, phase: 'joining',
    announceMsgId: null, startTimer: null, questionTimer: null, currentPollId: null, pollIds: []
  };
  groupSessions[s.groupId] = session;
  delete setups[hostId];

  bot.sendMessage(session.groupId, announceText(session), {
    reply_markup: { inline_keyboard: [[{ text: '\u2705 Men ham qatnashaman', callback_data: 'gjoin:' + session.groupId }]] }
  }).then(msg => {
    session.announceMsgId = msg.message_id;
  }).catch(e => {
    bot.sendMessage(hostChatId, "\u26A0\uFE0F Guruhga e'lon yuborib bo'lmadi: " + e.message + "\nBot guruhda admin ekanini tekshiring.");
    delete groupSessions[session.groupId];
  });

  bot.sendMessage(hostChatId, '\u2705 Test "' + session.title + '" guruhiga e\'lon qilindi.\n\uD83D\uDD50 ' + delayText(delayMs) + ' boshlanadi.');
  session.startTimer = setTimeout(() => startTest(bot, session.groupId), Math.max(0, startAt - Date.now()));
}

function announceText(session) {
  const count = Object.keys(session.participants).length;
  const names = Object.values(session.participants).map(p => p.name).slice(0, 15).join(', ');
  const when = session.startAt <= Date.now() ? 'boshlanmoqda' : delayText(session.startAt - Date.now());
  return (
    '\uD83D\uDCE3 YANGI TEST!\n\n' +
    '\uD83D\uDCDA Mavzu: ' + session.label + '\n' +
    '\u2753 Savollar: ' + session.count + ' ta\n' +
    '\u23F1 Har savolga: ' + session.seconds + ' soniya\n' +
    '\uD83D\uDD50 Boshlanish: ' + when + '\n\n' +
    '\uD83D\uDC65 Qatnashuvchilar (' + count + '): ' + (names || '\u2014') + '\n\n' +
    'Qatnashish uchun pastdagi tugmani bosing \uD83D\uDC47'
  );
}

// ---------------- "Men ham qatnashaman" ----------------
function handleJoin(bot, query, groupIdStr) {
  const groupId = Number(groupIdStr);
  const session = groupSessions[groupId];
  if (!session || session.phase === 'done') {
    bot.answerCallbackQuery(query.id, { text: 'Bu test allaqachon tugagan yoki bekor qilingan.' }).catch(() => {});
    return true;
  }
  const user = query.from;
  if (session.participants[user.id]) {
    bot.answerCallbackQuery(query.id, { text: "Siz allaqachon ro'yxatdasiz \u2705" }).catch(() => {});
    return true;
  }
  session.participants[user.id] = { name: fullName(user), score: 0, answered: {} };
  bot.answerCallbackQuery(query.id, { text: "Ro'yxatga olindingiz! \u2705" }).catch(() => {});
  if (session.phase === 'joining' && session.announceMsgId) {
    bot.editMessageText(announceText(session), {
      chat_id: groupId, message_id: session.announceMsgId,
      reply_markup: { inline_keyboard: [[{ text: '\u2705 Men ham qatnashaman', callback_data: 'gjoin:' + groupId }]] }
    }).catch(() => {});
  }
  return true;
}

// ---------------- Testni boshlash ----------------
function startTest(bot, groupId) {
  const session = groupSessions[groupId];
  if (!session || session.phase !== 'joining') return;
  session.phase = 'running';
  const count = Object.keys(session.participants).length;
  bot.sendMessage(groupId,
    '\uD83D\uDE80 Test boshlandi!\n\uD83D\uDCDA ' + session.label + ' \u2022 ' + session.count + ' ta savol\n\uD83D\uDC65 ' + count + ' ishtirokchi\n\nOmad!');
  setTimeout(() => sendNext(bot, groupId), 1500);
}

function sendNext(bot, groupId) {
  const session = groupSessions[groupId];
  if (!session || session.phase !== 'running') return;
  const q = session.list[session.index];

  bot.sendPoll(groupId,
    '\u2753 ' + (session.index + 1) + '/' + session.list.length + '  \u2022  ' + q.text,
    q.options,
    { type: 'quiz', correct_option_id: q.correct, open_period: session.seconds, is_anonymous: false }
  ).then(msg => {
    if (msg && msg.poll) {
      session.currentPollId = msg.poll.id;
      session.pollIds.push(msg.poll.id);
      pollToGroup[msg.poll.id] = { groupId, qIndex: session.index, correct: q.correct };
    }
    session.questionTimer = setTimeout(() => advance(bot, groupId), (session.seconds + 2) * 1000);
  }).catch(e => {
    bot.sendMessage(session.hostChatId, "\u26A0\uFE0F Guruhda savol yuborishda xato: " + e.message);
    finish(bot, groupId);
  });
}

function advance(bot, groupId) {
  const session = groupSessions[groupId];
  if (!session || session.phase !== 'running') return;
  session.index++;
  if (session.index < session.list.length) {
    setTimeout(() => sendNext(bot, groupId), 1500);
  } else {
    finish(bot, groupId);
  }
}

// poll_answer (faqat guruh poll'lari uchun)
function handleAnswer(bot, pollAnswer) {
  const info = pollToGroup[pollAnswer.poll_id];
  if (!info) return; // bu guruh poll'i emas (Stage 1 ga tegishli bo'lishi mumkin)
  const session = groupSessions[info.groupId];
  if (!session) return;
  const user = pollAnswer.user;
  if (!user) return;

  if (!session.participants[user.id]) {
    session.participants[user.id] = { name: fullName(user), score: 0, answered: {} };
  }
  const part = session.participants[user.id];
  if (part.answered[info.qIndex]) return; // shu savolga allaqachon javob bergan
  part.answered[info.qIndex] = true;
  const chosen = (pollAnswer.option_ids || [])[0];
  if (chosen === info.correct) part.score++;
}

// ---------------- Yakunlash + reyting ----------------
function finish(bot, groupId) {
  const session = groupSessions[groupId];
  if (!session || session.phase === 'done') return;
  session.phase = 'done';
  if (session.questionTimer) clearTimeout(session.questionTimer);
  session.pollIds.forEach(id => delete pollToGroup[id]);

  const total = session.list.length;
  const ranking = Object.entries(session.participants)
    .map(([id, p]) => ({ id, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);

  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
  let board = '\uD83C\uDFC1 Test yakunlandi!\n\uD83D\uDCDA ' + session.label + ' \u2022 ' + total + ' ta savol\n\n';
  if (!ranking.length) {
    board += "Hech kim qatnashmadi \uD83D\uDE15";
  } else {
    board += "\uD83C\uDFC6 Natijalar:\n";
    ranking.slice(0, 20).forEach((r, i) => {
      const m = medals[i] || (i + 1) + '.';
      board += m + ' ' + r.name + ' \u2014 ' + r.score + '/' + total + '\n';
    });
  }
  bot.sendMessage(groupId, board);

  let hostText = '\uD83D\uDCCA "' + session.title + '" \u2014 test natijalari\n\uD83D\uDCDA ' + session.label + ' \u2022 ' + total + ' ta savol\n\uD83D\uDC65 Qatnashdi: ' + ranking.length + '\n\n';
  ranking.forEach((r, i) => { hostText += (i + 1) + '. ' + r.name + ' \u2014 ' + r.score + '/' + total + '\n'; });
  bot.sendMessage(session.hostChatId, hostText);

  // Har ishtirokchi natijasini shaxsiy statistikaga ham qo'shamiz
  ranking.forEach(r => {
    const pct = Math.round((r.score / total) * 100);
    storage.addResult({
      userId: Number(r.id), label: session.label + ' (guruh)',
      directionKey: session.dir, subKey: session.sub,
      score: r.score, total, pct, date: new Date().toISOString()
    });
  });

  delete groupSessions[groupId];
}

module.exports = { setBotId, startHosting, handleCallback, handleMyChatMember, handleAnswer };
