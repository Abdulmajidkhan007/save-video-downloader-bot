'use strict';

// Toza muhit
const os = require('os');
const path = require('path');
const fs = require('fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'anonim-test-'));
process.env.DATA_DIR = tmp;
process.env.ADMIN_ID = '999';
process.env.RATE_PER_MIN = '3';   // test uchun pastroq
process.env.RATE_PER_HOUR = '100';

const util = require('../src/util');
const handlers = require('../src/handlers');
const admin = require('../src/admin');
const { state } = require('../src/state');

util.setBotUsername('test_anonim_bot');

// ────────── Soxta bot ──────────
function makeFakeBot(opts = {}) {
  const calls = {
    sendMessage: [], sendPhoto: [], copyMessage: [],
    editMessageText: [], editMessageReplyMarkup: [],
    answerCallbackQuery: [], deleteMessage: [],
  };
  let mid = 1000;
  const fake = {
    async sendMessage(chatId, text, options) {
      calls.sendMessage.push({ chatId: String(chatId), text, options: options || {} });
      return { message_id: ++mid, chat: { id: chatId } };
    },
    async sendPhoto(chatId, photo, options) {
      calls.sendPhoto.push({ chatId: String(chatId), photo, options: options || {} });
      return { message_id: ++mid, chat: { id: chatId } };
    },
    async copyMessage(chatId, fromId, m, options) {
      calls.copyMessage.push({ chatId: String(chatId), fromId, m, options: options || {} });
      return { message_id: ++mid };
    },
    async editMessageText(text, options) { calls.editMessageText.push({ text, options }); return true; },
    async editMessageReplyMarkup(markup, options) { calls.editMessageReplyMarkup.push({ markup, options }); return true; },
    async deleteMessage(chatId, m) { calls.deleteMessage.push({ chatId, m }); return true; },
    async answerCallbackQuery(id, o) { calls.answerCallbackQuery.push({ id, opts: o || {} }); return true; },
    async getChatMember(chat, userId) {
      if (opts.getChatMember) return opts.getChatMember(chat, userId);
      return { status: 'member' };
    },
    async getChat(target) {
      if (opts.getChat) return opts.getChat(target);
      return { id: -100123456, title: 'Test', username: target.replace('@', '') };
    },
  };
  return { fake, calls };
}

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('  ✅', label); } else { fail++; console.log('  ❌', label); } };

const mkMsg = (userId, fields = {}) => ({
  from: { id: userId, first_name: 'U' + userId, is_bot: false },
  chat: { id: userId, type: 'private' },
  message_id: Math.floor(Math.random() * 1e6),
  ...fields,
});
const mkCb = (userId, data, chatId, msgId) => ({
  id: 'cb-' + Math.random(),
  from: { id: userId, first_name: 'U' + userId, is_bot: false },
  data,
  message: { chat: { id: chatId }, message_id: msgId },
});

(async () => {
  let { fake: bot, calls } = makeFakeBot();

  // 1) A /start
  console.log('\n— 1) A /start —');
  await handlers.handleStart(bot, mkMsg(111, { text: '/start' }), null);
  const A = state.users['111'];
  ok(A && A.code, "A ro'yxatga olindi va kod oldi");
  ok(calls.sendPhoto.some((c) => c.chatId === '111'), 'A ga welcome rasmi yuborildi');

  // 2) B referral
  console.log('\n— 2) B referral havola orqali —');
  await handlers.handleStart(bot, mkMsg(222, { text: '/start ' + A.code }), A.code);
  ok(state.sessions['222'] === '111', 'B sessiyasi A ga ulandi');
  ok(calls.sendMessage.some((c) => c.chatId === '222' && c.text.includes('Murojaatingizni')), 'standart yozish so\'rovi');

  // 3) B birinchi xabar -> A oladi + reply kontekstida saqlanadi
  console.log('\n— 3) B xabar, A oladi (sourceMid bilan) —');
  const bMsg = mkMsg(222, { text: 'Salom A!' });
  await handlers.handleMessage(bot, bMsg);
  const aGot = calls.sendMessage.find((c) => c.chatId === '111' && c.text.includes('Salom A'));
  ok(!!aGot, 'A ga anonim xabar keldi');
  const buttons = aGot && aGot.options.reply_markup && aGot.options.reply_markup.inline_keyboard[0].map((b) => b.text);
  ok(buttons && buttons.some((t) => t.includes('Bloklash')) && buttons.some((t) => t.includes('Shikoyat')), 'Bloklash + Shikoyat tugmalari');
  const tk = Object.keys(state.threads).filter((k) => k.startsWith('111:'));
  const tval = state.threads[tk[tk.length - 1]];
  ok(tval && typeof tval === 'object' && tval.sender === '222' && tval.sourceMid === bMsg.message_id,
    'threadda sender va sourceMid saqlangan');

  // 4) A reply qiladi -> B reply_to_message_id bilan oladi (asl xabariga reply)
  console.log('\n— 4) A reply qiladi —');
  const aRecvMid = Number(tk[tk.length - 1].split(':')[1]);
  await handlers.handleMessage(bot, mkMsg(111, { text: 'Yaxshi', reply_to_message: { message_id: aRecvMid } }));
  const bGot = calls.sendMessage.find((c) => c.chatId === '222' && c.text.includes('Yaxshi'));
  ok(!!bGot, 'B javobni oldi');
  ok(bGot && bGot.options.reply_to_message_id === bMsg.message_id,
    "reply_to_message_id = B ning asl xabar id'si (quote ko'rinadi)");

  // 5) Block tugmasi
  console.log('\n— 5) Bloklash —');
  await handlers.handleCallback(bot, mkCb(111, 'b:222', 111, aRecvMid));
  ok((state.blocks['111'] || []).includes('222'), 'B blocks[A] da');

  // 6) Bloklangan yuborolmaydi
  state.sessions['222'] = '111';
  calls.sendMessage = [];
  await handlers.handleMessage(bot, mkMsg(222, { text: 'Yana xabar' }));
  ok(calls.sendMessage.some((c) => c.chatId === '222' && c.text.includes('bloklagan')), 'B ga "bloklagan" javobi');

  // 7) /blocks
  console.log('\n— 7) /blocks ro\'yxati —');
  calls.sendMessage = [];
  await handlers.handleBlocks(bot, mkMsg(111));
  const blMsg = calls.sendMessage.find((c) => c.chatId === '111' && c.text.includes('Bloklanganlar'));
  ok(!!blMsg, '/blocks ro\'yxatni ko\'rsatdi');
  ok(blMsg && blMsg.options.reply_markup.inline_keyboard.length >= 1, 'unblock tugmasi bor');

  // 8) Unblock
  await handlers.handleCallback(bot, mkCb(111, 'ub:222', 111, 5555));
  ok(!(state.blocks['111'] || []).includes('222'), 'B bloki ochildi');

  // 9) Rate limit (3/daqiqa)
  console.log('\n— 9) Rate limit —');
  state.rateLimits.clear();
  // 3 ta xabar yuboramiz
  for (let i = 0; i < 3; i++) {
    state.sessions['222'] = '111';
    await handlers.handleMessage(bot, mkMsg(222, { text: `M${i}` }));
  }
  // 4-chi bloklanishi kerak
  state.sessions['222'] = '111';
  calls.sendMessage = [];
  await handlers.handleMessage(bot, mkMsg(222, { text: 'Spam!' }));
  ok(calls.sendMessage.some((c) => c.chatId === '222' && c.text.includes("Juda ko'p")), 'Rate limit ishladi');

  // 10) Shikoyat
  console.log('\n— 10) Shikoyat —');
  state.rateLimits.clear();
  state.sessions['222'] = '111';
  await handlers.handleMessage(bot, mkMsg(222, { text: 'Bezor xabar' }));
  const newKeys = Object.keys(state.threads).filter((k) => k.startsWith('111:'));
  const lastMid = Number(newKeys[newKeys.length - 1].split(':')[1]);
  calls.sendMessage = []; calls.copyMessage = [];
  await handlers.handleCallback(bot, mkCb(111, 'r:222', 111, lastMid));
  ok(calls.sendMessage.some((c) => c.chatId === '999' && c.text.includes('Shikoyat')), 'Admin shikoyat oldi');
  ok(calls.copyMessage.some((c) => c.chatId === '999'), 'Asl xabar adminga nusxalandi');
  ok(state.stats.reports >= 1, 'reports stat ortdi');

  // 11) Admin global ban
  console.log('\n— 11) Global Ban —');
  await handlers.handleCallback(bot, mkCb(999, 'gban:222', 999, 7777));
  ok(!!state.bans['222'], 'B banlandi');

  // 12) Banlangan /start
  calls.sendMessage = [];
  await handlers.handleStart(bot, mkMsg(222, { text: '/start' }), null);
  ok(calls.sendMessage.some((c) => c.chatId === '222' && c.text.includes('cheklangan')), 'B ga "cheklangan"');

  // 13) Unban
  await handlers.handleCallback(bot, mkCb(999, 'gunban:222', 999, 8888));
  ok(!state.bans['222'], 'B bani ochildi');

  // 14) /welcome
  console.log('\n— 14) Maxsus salomlashuv —');
  await handlers.handleSetWelcome(bot, mkMsg(111), null);  // ko'rsatish
  ok(calls.sendMessage.some((c) => c.chatId === '111' && c.text.includes('Maxsus salomlashuv')), 'help matni ko\'rsatildi');
  await handlers.handleSetWelcome(bot, mkMsg(111), 'Salom, men Abdulmajid 🙂');
  ok(state.users['111'].welcome === 'Salom, men Abdulmajid 🙂', 'welcome matn saqlandi');
  // C kiradi → A ning salomlashuvini ko'radi
  calls.sendMessage = [];
  await handlers.handleStart(bot, mkMsg(333, { text: '/start ' + A.code }), A.code);
  ok(calls.sendMessage.some((c) => c.chatId === '333' && c.text.includes('Abdulmajid')), 'C ga A ning maxsus salomi keldi');
  // Tozalash
  await handlers.handleSetWelcome(bot, mkMsg(111), '-');
  ok(!state.users['111'].welcome, 'welcome tozalandi');

  // 15) Admin panel
  console.log('\n— 15) /anoner paneli —');
  calls.sendMessage = [];
  await admin.handleAnonerCommand(bot, mkMsg(999, { text: '/anoner' }));
  const panel = calls.sendMessage.find((c) => c.chatId === '999' && c.text.includes('Admin panel'));
  ok(!!panel, 'Admin panel ochildi');
  ok(panel && panel.options.reply_markup.inline_keyboard.length === 3, 'Panelda 3 qator tugma');
  // Non-admin /anoner — javob yo'q
  calls.sendMessage = [];
  await admin.handleAnonerCommand(bot, mkMsg(111, { text: '/anoner' }));
  ok(!calls.sendMessage.some((c) => c.chatId === '111'), 'Non-admin /anoner — javob yo\'q');

  // 16) Admin sub-sahifalar
  await handlers.handleCallback(bot, mkCb(999, 'a:stats', 999, 9001));
  ok(calls.editMessageText.some((c) => c.text.includes('Statistika')), 'Statistika ko\'rinadi');
  await handlers.handleCallback(bot, mkCb(999, 'a:users:0', 999, 9001));
  ok(calls.editMessageText.some((c) => c.text.includes('Foydalanuvchilar')), 'Foydalanuvchilar sahifasi');
  // raqamli tugmalar
  const usersEdit = calls.editMessageText.filter((c) => c.text.includes('Foydalanuvchilar')).pop();
  const userNumBtns = usersEdit.options.reply_markup.inline_keyboard
    .flat().filter((b) => b.callback_data && b.callback_data.startsWith('a:user:'));
  ok(userNumBtns.length > 0, 'foydalanuvchilar uchun raqamli tugmalar bor');

  // Batafsil ko'rinish + referral havola
  await handlers.handleCallback(bot, mkCb(999, `a:user:111`, 999, 9001));
  const detail = calls.editMessageText.filter((c) => c.text.includes('Foydalanuvchi haqida')).pop();
  ok(!!detail, 'foydalanuvchi batafsil ko\'rinishi ochildi');
  ok(detail && detail.text.includes('Referral havola'), 'referral havola sarlavhasi bor');
  ok(detail && detail.text.includes(A.code), 'havolada A ning kodi bor');
  ok(detail && detail.text.includes('test_anonim_bot'), 'havolada bot username bor');

  // Detaildan banlash
  await handlers.handleCallback(bot, mkCb(999, `a:ban:111`, 999, 9001));
  ok(!!state.bans['111'], 'A detaildan banlandi');
  // banlangan holatda — bani ochish tugmasi ko'rinadi
  const afterBan = calls.editMessageText.filter((c) => c.text.includes('Foydalanuvchi haqida')).pop();
  const banBtns = afterBan.options.reply_markup.inline_keyboard.flat().map((b) => b.text);
  ok(banBtns.some((t) => t.includes('Bani ochish')), 'banlangan foydalanuvchida "Bani ochish" tugmasi');
  // ochish
  await handlers.handleCallback(bot, mkCb(999, `a:unban:111`, 999, 9001));
  ok(!state.bans['111'], 'detaildan bani ochildi');
  await handlers.handleCallback(bot, mkCb(999, 'a:bans', 999, 9001));
  ok(calls.editMessageText.some((c) => c.text.includes('Banlangan')), 'Banlar sahifasi');
  await handlers.handleCallback(bot, mkCb(999, 'a:ch', 999, 9001));
  ok(calls.editMessageText.some((c) => c.text.includes('Kanallar')), 'Kanallar sahifasi');

  // 17) Admin emas — rad etiladi
  await handlers.handleCallback(bot, mkCb(111, 'a:stats', 111, 1));
  ok(calls.answerCallbackQuery.some((c) => c.opts.text && c.opts.text.includes('admin uchun')), 'Admin bo\'lmagan rad etildi');

  // 18) Broadcast
  console.log('\n— 18) Broadcast —');
  await handlers.handleCallback(bot, mkCb(999, 'a:bc', 999, 9001));
  ok(admin.isAwaitingBroadcast('999'), 'Admin broadcast holatida');
  calls.copyMessage = [];
  await handlers.handleMessage(bot, mkMsg(999, { text: 'Hammaga xabar!' }));
  const userCount = Object.keys(state.users).length;
  ok(calls.copyMessage.length === userCount, `Broadcast ${userCount} ta foydalanuvchiga yuborildi`);
  ok(!admin.isAwaitingBroadcast('999'), 'Broadcast holati tozalandi');

  // 19) Kanal qo'shish
  console.log('\n— 19) Kanal qo\'shish —');
  await handlers.handleCallback(bot, mkCb(999, 'a:ch:add', 999, 9001));
  ok(admin.isAwaitingChannel('999'), 'Admin kanal qo\'shish holatida');
  await handlers.handleMessage(bot, mkMsg(999, { text: '@testkanal' }));
  ok(state.channels.length === 1 && state.channels[0].username === 'testkanal', 'Kanal qo\'shildi');

  // 20) Majburiy kanal — obuna bo'lmagan
  console.log('\n— 20) Majburiy kanal obunasi —');
  const { fake: bot2, calls: c2 } = makeFakeBot({
    getChatMember: async (_chat, uid) => ({ status: String(uid) === '444' ? 'left' : 'member' }),
  });
  await handlers.handleStart(bot2, mkMsg(444, { text: '/start' }), null);
  const subPrompt = c2.sendMessage.find((c) => c.chatId === '444' && c.text.includes('obuna'));
  ok(!!subPrompt, '444 ga obuna so\'rovi keldi');
  const kb = subPrompt && subPrompt.options.reply_markup.inline_keyboard;
  ok(kb && kb.some((row) => row.some((b) => b.text.includes('Tekshirish'))), '"Tekshirish" tugmasi bor');

  // 21) Kanal o'chirish
  await handlers.handleCallback(bot, mkCb(999, 'chrm:0', 999, 9001));
  ok(state.channels.length === 0, 'Kanal o\'chirildi');

  // 22) O'ziga yuborish bloki
  console.log('\n— 22) O\'ziga yuborish —');
  const { fake: bot3, calls: c3 } = makeFakeBot();
  await handlers.handleStart(bot3, mkMsg(111, { text: '/start ' + A.code }), A.code);
  ok(c3.sendMessage.some((c) => c.chatId === '111' && c.text.includes("zingizga")), 'o\'ziga yuborish bloklandi');

  // 23) Noto'g'ri havola
  await handlers.handleStart(bot3, mkMsg(555, { text: '/start invalidkod' }), 'invalidkod');
  ok(c3.sendMessage.some((c) => c.chatId === '555' && c.text.includes("eskirgan")), 'noto\'g\'ri havola haqida ogohlantirildi');

  // 25) /admin — foydalanuvchidan adminga bog'lanish
  console.log('\n— 25) /admin (bog\'lanish) —');
  state.rateLimits.clear();
  state.adminContact.clear();
  const { fake: bot5, calls: c5 } = makeFakeBot();
  // Non-admin /admin
  await handlers.handleAdminContact(bot5, mkMsg(111, { text: '/admin' }));
  ok(state.adminContact.get('111') === true, 'adminContact holati o\'rnatildi');
  ok(c5.sendMessage.some((c) => c.chatId === '111' && c.text.includes("bog'lanmoqdasiz")), '"bog\'lanmoqdasiz" xabari yuborildi');

  // Foydalanuvchi xabar yuboradi — adminga yetadi
  c5.sendMessage = [];
  const userMsg = mkMsg(111, { text: 'Salom admin, savolim bor' });
  await handlers.handleMessage(bot5, userMsg);
  const adminGot = c5.sendMessage.find((c) => c.chatId === '999' && c.text.includes('Foydalanuvchidan'));
  ok(!!adminGot, 'Admin foydalanuvchi xabarini oldi');
  ok(adminGot && adminGot.text.includes('Salom admin, savolim bor'), 'Xabar mazmuni adminga keldi');
  ok(adminGot && adminGot.text.includes('id: `111`'), 'Adminga sender ID ko\'rsatildi');
  ok(c5.sendMessage.some((c) => c.chatId === '111' && c.text.includes('adminga yetkazildi')), 'Foydalanuvchiga tasdiq berildi');
  ok(!state.adminContact.get('111'), 'adminContact holati tozalandi');
  // Adminga yuborilgan xabarda tugmalar yo'q
  ok(!adminGot.options.reply_markup, 'Admin xabarida block/report tugmalari yo\'q');

  // 26) Admin javob qaytaradi
  console.log('\n— 26) Admin javob qaytaradi —');
  const adminThreadKeys = Object.keys(state.threads).filter((k) => k.startsWith('999:'));
  const adminMid = Number(adminThreadKeys[adminThreadKeys.length - 1].split(':')[1]);
  await handlers.handleMessage(bot5, mkMsg(999, { text: 'Salom, qanday yordam beray?', reply_to_message: { message_id: adminMid } }));
  const userGot = c5.sendMessage.find((c) => c.chatId === '111' && c.text.includes('qanday yordam beray'));
  ok(!!userGot, 'Foydalanuvchi admin javobini oldi');
  ok(userGot && userGot.text.includes('Admin javobi'), '"Admin javobi" sarlavhasi bor');
  ok(userGot && !userGot.options.reply_markup, 'Admin javobida block/report tugmalari yo\'q');
  ok(userGot && userGot.options.reply_to_message_id === userMsg.message_id, 'Asl xabarga reply tarzida ko\'rinadi');

  // 27) Admin /admin tersa — /anoner ga ishora
  console.log('\n— 27) Admin /admin tersa —');
  c5.sendMessage = [];
  await handlers.handleAdminContact(bot5, mkMsg(999, { text: '/admin' }));
  ok(c5.sendMessage.some((c) => c.chatId === '999' && c.text.includes('/anoner')), 'Admin uchun /anoner haqida ishora');

  // 28) Kanalga obuna bo'lganda admin'ga bildirish
  console.log('\n— 28) Kanal obuna bildirishnomasi —');
  state.channels = [{ id: -1009999, title: 'Test Kanal', username: 'testkanal' }];
  c5.sendMessage = [];
  await handlers.handleChatMember(bot5, {
    chat: { id: -1009999, title: 'Test Kanal', username: 'testkanal' },
    new_chat_member: {
      status: 'member',
      user: { id: 7777, first_name: 'Yangi', last_name: 'Obunachi', username: 'yangi_user', is_bot: false },
    },
    old_chat_member: { status: 'left' },
  });
  const joinNote = c5.sendMessage.find((c) => c.chatId === '999' && c.text.includes('Yangi obunachi'));
  ok(!!joinNote, 'Admin obuna bildirishnomasini oldi');
  ok(joinNote && joinNote.text.includes('7777'), 'foydalanuvchi ID si bor');
  ok(joinNote && joinNote.text.includes('Test Kanal'), 'kanal nomi bor');

  // Chiqib ketganda
  c5.sendMessage = [];
  await handlers.handleChatMember(bot5, {
    chat: { id: -1009999, title: 'Test Kanal', username: 'testkanal' },
    new_chat_member: {
      status: 'left',
      user: { id: 7777, first_name: 'Yangi', last_name: 'Obunachi', username: 'yangi_user', is_bot: false },
    },
    old_chat_member: { status: 'member' },
  });
  ok(c5.sendMessage.some((c) => c.chatId === '999' && c.text.includes('Kanaldan chiqdi')), 'Chiqish bildirishnomasi yuborildi');

  // Bizniki bo'lmagan kanal — ignore qilinadi
  c5.sendMessage = [];
  await handlers.handleChatMember(bot5, {
    chat: { id: -1008888, title: 'Boshqa', username: 'boshqa' },
    new_chat_member: { status: 'member', user: { id: 8888, first_name: 'X', is_bot: false } },
    old_chat_member: { status: 'left' },
  });
  ok(!c5.sendMessage.some((c) => c.chatId === '999'), 'Bizniki bo\'lmagan kanaldan bildirishnoma yo\'q');

  // 29) Bot statusi o'zgarsa — admin'ga xabar
  console.log('\n— 29) Bot statusi —');
  c5.sendMessage = [];
  await handlers.handleMyChatMember(bot5, {
    chat: { id: -1009999, title: 'Test Kanal', username: 'testkanal' },
    new_chat_member: { status: 'administrator', user: { id: 1, is_bot: true } },
    old_chat_member: { status: 'left' },
  });
  ok(c5.sendMessage.some((c) => c.chatId === '999' && c.text.includes('admin qilindi')), 'Admin bot promotion haqida xabar oldi');

  c5.sendMessage = [];
  await handlers.handleMyChatMember(bot5, {
    chat: { id: -1009999, title: 'Test Kanal', username: 'testkanal' },
    new_chat_member: { status: 'left', user: { id: 1, is_bot: true } },
    old_chat_member: { status: 'administrator' },
  });
  ok(c5.sendMessage.some((c) => c.chatId === '999' && c.text.includes('olib tashlandi')), 'Bot olib tashlanishi xabar berildi');

  // 30) Foydalanuvchi botni bloklaganda — kim ekanligi ko'rinadi
  console.log('\n— 30) Foydalanuvchi botni bloklaganda —');
  state.users['7777'] = { code: 'abc123', name: 'Abdulmajid', username: 'majid007', joinedAt: '' };
  c5.sendMessage = [];
  await handlers.handleMyChatMember(bot5, {
    chat: { id: 7777, type: 'private', first_name: 'Abdulmajid', username: 'majid007' },
    from: { id: 7777, first_name: 'Abdulmajid', username: 'majid007' },
    new_chat_member: { status: 'kicked', user: { id: 1, is_bot: true } },
    old_chat_member: { status: 'member' },
  });
  const blockNote = c5.sendMessage.find((c) => c.chatId === '999' && c.text.includes('bloklagan'));
  ok(!!blockNote, 'Admin bloklash xabarini oldi');
  ok(blockNote && blockNote.text.includes('Abdulmajid'), 'foydalanuvchi ismi bor');
  ok(blockNote && blockNote.text.includes('@majid007'), 'foydalanuvchi username bor');
  ok(blockNote && blockNote.text.includes('7777'), 'foydalanuvchi ID si bor');

  // Qayta ochganda
  c5.sendMessage = [];
  await handlers.handleMyChatMember(bot5, {
    chat: { id: 7777, type: 'private', first_name: 'Abdulmajid', username: 'majid007' },
    from: { id: 7777, first_name: 'Abdulmajid', username: 'majid007' },
    new_chat_member: { status: 'member', user: { id: 1, is_bot: true } },
    old_chat_member: { status: 'kicked' },
  });
  const unblockNote = c5.sendMessage.find((c) => c.chatId === '999' && c.text.includes('qayta ochgan'));
  ok(!!unblockNote, 'Admin qayta ochish xabarini oldi');
  ok(unblockNote && unblockNote.text.includes('7777'), 'qayta ochishda ham ID bor');

  console.log(`\n══════════════════════════════════\n  Natija: ${pass} o'tdi, ${fail} muvaffaqiyatsiz\n══════════════════════════════════`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH:', e); process.exit(1); });
