// ============================================================
//  ADMIN PANEL (faqat admin uchun) — 3-bosqich
//  - Dashboard: foydalanuvchilar, testlar, kategoriyalar soni
//  - Savol qo'shish / tahrirlash / o'chirish
//  - Yangi bo'lim yaratish
//  Admin ID'lar .env (ADMIN_IDS) dan olinadi.
// ============================================================
const { ADMIN_IDS } = require('../config');
const storage = require('./storage');
const questions = require('./questions');

// Admin kiritish holatlari (xotirada): userId -> { action, dir, sub, editIndex, step, qtext, options }
const aStates = {};

function isAdmin(userId) {
  return ADMIN_IDS.includes(Number(userId));
}
function getAllDirs() { return storage.getDirections(); }
function dirLabel(key) {
  const d = getAllDirs().find(x => x.key === key);
  return d ? d.label : key;
}
function slugify(s) {
  const slug = (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return slug || ('topic' + Date.now());
}
function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

// ---------------- Panelni ochish ----------------
function panelContent() {
  const st = questions.stats();
  const users = Object.keys(storage.getUsers()).length;
  const tests = storage.getResults().length;
  const groups = Object.keys(storage.getGroups()).length;
  const chans = storage.getChannels().length;
  const text =
    `🛠 ADMIN PANEL\n\n` +
    `👤 Foydalanuvchilar: ${users}\n` +
    `📝 Ishlangan testlar: ${tests}\n` +
    `👥 Bog'langan guruhlar: ${groups}\n` +
    `📢 Majburiy kanallar: ${chans}\n` +
    `📚 Yo'nalishlar: ${st.directions}\n` +
    `🗂 Bo'limlar: ${st.subs}\n` +
    `❓ Jami savollar: ${st.totalQuestions}\n\n` +
    `Quyidagidan birini tanlang:`;
  const rows = [
    [{ text: '➕ Savol qo\'shish', callback_data: 'a:add' }],
    [{ text: '✏️ Savol tahrirlash', callback_data: 'a:edit' }],
    [{ text: '🗑 Savol o\'chirish', callback_data: 'a:del' }],
    [{ text: '🆕 Yangi bo\'lim', callback_data: 'a:newsub' }],
    [{ text: '📢 Majburiy kanallar', callback_data: 'a:chans' }],
    [{ text: '👤 Foydalanuvchilar', callback_data: 'a:users:0' }],
    [{ text: '👥 Guruhlar', callback_data: 'a:groups' }],
    [{ text: '📚 Yo\'nalishlar va bo\'limlar', callback_data: 'a:tree' }]
  ];
  return { text, rows };
}
function openPanel(bot, chatId, userId) {
  if (!isAdmin(userId)) { bot.sendMessage(chatId, "⛔ Bu bo'lim faqat adminlar uchun."); return; }
  const { text, rows } = panelContent();
  bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: rows } });
}

// Asosiy menyudan "➕ Savol qo'shish" tugmasi uchun (hamma uchun ochiq)
function startAdd(bot, chatId) {
  bot.sendMessage(chatId, "➕ Qaysi yo'nalishga savol qo'shamiz?", {
    reply_markup: { inline_keyboard: dirButtons('a:adir') }
  });
}
// Asosiy menyudan "🆕 Yangi bo'lim" tugmasi uchun (hamma uchun ochiq)
function startNewSub(bot, chatId) {
  bot.sendMessage(chatId, "🆕 Qaysi yo'nalishga yangi bo'lim?", {
    reply_markup: { inline_keyboard: dirButtons('a:nsdir') }
  });
}
// Asosiy menyudan "🆕 Yangi yo'nalish" tugmasi uchun (hamma uchun ochiq)
function startNewDir(bot, chatId, userId) {
  aStates[userId] = { action: 'newdir', step: 'newdir_name' };
  bot.sendMessage(chatId, "🆕 Yangi yo'nalish nomini yuboring (masalan: QA Testing, Data Science).\n\nBekor qilish uchun /bekor.");
}
function channelsView() {
  const chans = storage.getChannels();
  const rows = chans.map((ch, i) => [{ text: `🗑 ${ch}`, callback_data: `a:chrm:${i}` }]);
  rows.push([{ text: '➕ Kanal qo\'shish', callback_data: 'a:chadd' }]);
  rows.push([{ text: '⬅️ Orqaga', callback_data: 'a:home' }]);
  const text = chans.length
    ? `📢 Majburiy kanallar (${chans.length}):\n` + chans.map((c, i) => `${i + 1}. ${c}`).join('\n') + `\n\nO'chirish uchun kanal ustiga bosing.`
    : "📢 Hozircha majburiy kanal yo'q.\n\nQo'shish uchun pastdagi tugmani bosing.";
  return { text, rows };
}

// Foydalanuvchilar ro'yxati (sahifalab, har sahifada 10 ta)
function usersView(page) {
  const PAGE = 10;
  const all = Object.values(storage.getUsers()).sort((a, b) =>
    new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0)
  );
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const slice = all.slice(p * PAGE, p * PAGE + PAGE);
  let text = `👤 FOYDALANUVCHILAR (jami: ${total})\n\n`;
  if (!slice.length) {
    text += "Hali ro'yxatdan o'tgan foydalanuvchi yo'q.";
  } else {
    slice.forEach((u, i) => {
      const num = p * PAGE + i + 1;
      const date = u.registeredAt ? u.registeredAt.split('T')[0] : '-';
      text += `${num}. ${u.name || '?'}\n   📞 ${u.phone || '-'}\n   🆔 ${u.id}  •  📅 ${date}\n`;
    });
    text += `\n📄 Sahifa ${p + 1}/${pages}`;
  }
  const nav = [];
  if (p > 0) nav.push({ text: '⬅️ Oldingi', callback_data: `a:users:${p - 1}` });
  if (p < pages - 1) nav.push({ text: 'Keyingi ➡️', callback_data: `a:users:${p + 1}` });
  const rows = [];
  if (nav.length) rows.push(nav);
  rows.push([{ text: '🛠 Panelga', callback_data: 'a:home' }]);
  return { text, rows };
}

// Bog'langan guruhlar
function groupsView() {
  const all = Object.values(storage.getGroups());
  let text = `👥 BOG'LANGAN GURUHLAR (jami: ${all.length})\n\n`;
  if (!all.length) {
    text += "Hozircha bog'langan guruh yo'q.\nBot guruhga admin qilingach, bu yerda paydo bo'ladi.";
  } else {
    all.forEach((g, i) => {
      text += `${i + 1}. ${g.title || 'Guruh'}\n   🆔 ${g.id}  •  📁 ${g.type || '-'}\n`;
    });
  }
  return { text, rows: [[{ text: '🛠 Panelga', callback_data: 'a:home' }]] };
}

// Yo'nalishlar va bo'limlar daraxti
function treeView() {
  const dirs = questions.getDirections();
  let text = `📚 YO'NALISHLAR VA BO'LIMLAR\n\n`;
  if (!dirs.length) {
    text += "Hali yo'nalishlar yo'q.";
  } else {
    dirs.forEach(d => {
      const subs = questions.getSubs(d.key);
      const total = subs.reduce((s, x) => s + (x.count || 0), 0);
      text += `${d.emoji} ${d.label}  —  ${subs.length} ta bo'lim, ${total} ta savol\n`;
      subs.forEach(s => { text += `   • ${s.label} (${s.count})\n`; });
      text += '\n';
    });
  }
  return { text, rows: [[{ text: '🛠 Panelga', callback_data: 'a:home' }]] };
}

function dirButtons(prefix) {
  const all = getAllDirs();
  const rows = all.map(d => [{ text: `${d.emoji || '📚'} ${d.label}`, callback_data: `${prefix}:${d.key}` }]);
  rows.push([{ text: '🆕 Yangi yo\'nalish qo\'shish', callback_data: 'a:newdir' }]);
  rows.push([{ text: '❌ Bekor qilish', callback_data: 'a:home' }]);
  return rows;
}
function subButtons(dir, prefix, includeNew, backData) {
  const subs = questions.getSubs(dir);
  const rows = subs.map(s => [{ text: `${s.label} (${s.count})`, callback_data: `${prefix}:${dir}:${s.key}` }]);
  if (includeNew) rows.push([{ text: '🆕 Yangi bo\'lim', callback_data: `a:nsdir:${dir}` }]);
  if (backData) rows.push([{ text: '⬅️ Orqaga', callback_data: backData }]);
  return rows;
}

// Hamma uchun ochiq amallar (oddiy foydalanuvchi ham bajara oladi)
const PUBLIC_ACTIONS = new Set(['add', 'adir', 'asub', 'newsub', 'nsdir', 'newdir', 'correct', 'cancel', 'tree', 'home']);;

// ---------------- Callbacklarni boshqarish ----------------
// true qaytarsa — admin callback'i ishlandi
async function handleCallback(bot, query) {
  const data = query.data || '';
  if (data[0] !== 'a' || data[1] !== ':') return false;
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  const p = data.split(':');
  const action = p[1];

  // Faqat admin amallari uchun ruxsat tekshiruvi
  if (!PUBLIC_ACTIONS.has(action) && !isAdmin(userId)) {
    await bot.answerCallbackQuery(query.id, { text: '⛔ Faqat adminlar uchun.', show_alert: true });
    return true;
  }
  await bot.answerCallbackQuery(query.id).catch(() => {});
  const edit = (text, rows) => bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: rows } }).catch(() => bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: rows } }));

  // ----- Savol qo'shish: yo'nalish -> bo'lim -> matn -----
  if (action === 'add') { edit("➕ Qaysi yo'nalishga?", dirButtons('a:adir')); return true; }
  if (action === 'adir') { edit("📚 Qaysi bo'limga? (yoki yangi)", subButtons(p[2], 'a:asub', true, 'a:add')); return true; }
  if (action === 'asub') {
    aStates[userId] = { action: 'add', dir: p[2], sub: p[3], step: 'q_text' };
    edit(`✍️ "${questions.getSubLabel(p[2], p[3])}" uchun savol matnini yozing:\n(bekor: /bekor)`, []);
    return true;
  }

  // ----- Tahrirlash: yo'nalish -> bo'lim -> savol -> qayta kiritish -----
  if (action === 'edit') { edit("✏️ Qaysi yo'nalish?", dirButtons('a:edir')); return true; }
  if (action === 'edir') { edit("📚 Qaysi bo'lim?", subButtons(p[2], 'a:esub', false, 'a:edit')); return true; }
  if (action === 'esub') { edit("✏️ Tahrirlanadigan savolni tanlang:", questionListButtons(p[2], p[3], 'a:eq', `a:edir:${p[2]}`)); return true; }
  if (action === 'eq') {
    aStates[userId] = { action: 'edit', dir: p[2], sub: p[3], editIndex: parseInt(p[4], 10), step: 'q_text' };
    edit("✍️ Yangi savol matnini yozing:\n(bekor: /bekor)", []);
    return true;
  }

  // ----- O'chirish: yo'nalish -> bo'lim -> savol -> tasdiq -----
  if (action === 'del') { edit("🗑 Qaysi yo'nalish?", dirButtons('a:ddir')); return true; }
  if (action === 'ddir') { edit("📚 Qaysi bo'lim?", subButtons(p[2], 'a:dsub', false, 'a:del')); return true; }
  if (action === 'dsub') { edit("🗑 O'chiriladigan savolni tanlang:", questionListButtons(p[2], p[3], 'a:dq', `a:ddir:${p[2]}`)); return true; }
  if (action === 'dq') {
    const list = questions.getQuestions(p[2], p[3]);
    const q = list[parseInt(p[4], 10)];
    edit(`🗑 O'chirilsinmi?\n\n"${q ? q.q : '?'}"`, [
      [{ text: '✅ Ha, o\'chir', callback_data: `a:dyes:${p[2]}:${p[3]}:${p[4]}` }],
      [{ text: '⬅️ Yo\'q, orqaga', callback_data: `a:dsub:${p[2]}:${p[3]}` }]
    ]);
    return true;
  }
  if (action === 'dyes') {
    const ok = questions.deleteQuestion(p[2], p[3], parseInt(p[4], 10));
    edit(ok ? "✅ Savol o'chirildi." : "⚠️ O'chirib bo'lmadi.", [[{ text: '🛠 Panelga', callback_data: 'a:home' }]]);
    return true;
  }

  // ----- Yangi bo'lim -----
  if (action === 'newsub') { edit("🆕 Qaysi yo'nalishga yangi bo'lim?", dirButtons('a:nsdir')); return true; }
  if (action === 'newdir') {
    aStates[userId] = { action: 'newdir', step: 'newdir_name' };
    edit("🆕 Yangi yo'nalish nomini yuboring (masalan: QA Testing, Data Science).\n\nBekor qilish: /bekor.", []);
    return true;
  }
  if (action === 'nsdir') {
    aStates[userId] = { action: 'newsub', dir: p[2], step: 'newsub_name' };
    edit(`🆕 "${dirLabel(p[2])}" ichida yangi bo'lim nomini yozing (masalan: Node.js):`, []);
    return true;
  }

  // ----- To'g'ri javob tanlandi (qo'shish/tahrirlash yakuni) -----
  if (action === 'correct') {
    const st = aStates[userId];
    if (!st || st.step !== 'q_correct') { edit("⚠️ Sessiya tugagan. Qaytadan boshlang.", [[{ text: '🛠 Panelga', callback_data: 'a:home' }]]); return true; }
    const q = { q: st.qtext, options: st.options, correct: parseInt(p[2], 10) };
    const toPanel = [[{ text: '🛠 Panelga', callback_data: 'a:home' }]];
    if (st.action === 'add') {
      questions.addQuestion(st.dir, st.sub, q);
      edit(`✅ Savol qo'shildi: ${questions.getSubLabel(st.dir, st.sub)}\n\n"${q.q}"`, toPanel);
    } else if (st.action === 'edit') {
      const ok = questions.editQuestion(st.dir, st.sub, st.editIndex, q);
      edit(ok ? `✅ Savol tahrirlandi.\n\n"${q.q}"` : "⚠️ Tahrirlab bo'lmadi.", toPanel);
    }
    delete aStates[userId];
    return true;
  }

  // ----- Majburiy kanallar -----
  if (action === 'chans') { const v = channelsView(); edit(v.text, v.rows); return true; }
  if (action === 'chadd') { aStates[userId] = { action: 'channel', step: 'channel_add' }; edit("📢 Kanal username yuboring (masalan: @mychannel):", []); return true; }
  if (action === 'chrm') { storage.removeChannelAt(parseInt(p[2], 10)); const v = channelsView(); edit(v.text, v.rows); return true; }

  // ----- Foydalanuvchilar ro'yxati (sahifalab) -----
  if (action === 'users') {
    const page = parseInt(p[2], 10) || 0;
    const v = usersView(page);
    edit(v.text, v.rows);
    return true;
  }

  // ----- Bog'langan guruhlar -----
  if (action === 'groups') { const v = groupsView(); edit(v.text, v.rows); return true; }

  // ----- Yo'nalishlar va bo'limlar -----
  if (action === 'tree') { const v = treeView(); edit(v.text, v.rows); return true; }

  if (action === 'home') {
    if (!isAdmin(userId)) {
      // Oddiy foydalanuvchi uchun — shunchaki xabarni yopish
      edit("✅ Yakunlandi. Asosiy menyuga qaytish uchun /menu bosing.", []);
      return true;
    }
    const c = panelContent(); edit(c.text, c.rows); return true;
  }

  if (action === 'cancel') { delete aStates[userId]; edit("Bekor qilindi.", []); return true; }
  return true;
}

function questionListButtons(dir, sub, prefix, backData) {
  const list = questions.getQuestions(dir, sub);
  const rows = list.slice(0, 50).map((q, i) => [{ text: `${i + 1}. ${trunc(q.q || '', 40)}`, callback_data: `${prefix}:${dir}:${sub}:${i}` }]);
  if (!rows.length) rows.push([{ text: '⚠️ Bu bo\'limda savol yo\'q', callback_data: backData || 'a:home' }]);
  if (backData) rows.push([{ text: '⬅️ Orqaga', callback_data: backData }]);
  return rows;
}

// ---------------- Matnli xabarlar (kiritish bosqichlari) ----------------
// true qaytarsa — admin kiritishi sifatida ishlandi
function handleMessage(bot, msg) {
  const userId = msg.from.id;
  const st = aStates[userId];
  if (!st) return false;
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  if (text === '/bekor') { delete aStates[userId]; bot.sendMessage(chatId, "Bekor qilindi."); return true; }
  // /skip — emoji bosqichida default ishlatish uchun, qolgan / komandalarini o'tkazib yuboramiz
  if (text.startsWith('/') && text !== '/skip') return false;
  if (!text) { bot.sendMessage(chatId, "Iltimos matn yuboring (yoki /bekor)."); return true; }

  // Savol matni
  if (st.step === 'q_text') {
    st.qtext = text;
    st.step = 'q_opts';
    bot.sendMessage(chatId, "📝 Endi javob variantlarini yozing — har birini YANGI QATORGA (2–10 ta):");
    return true;
  }

  // Variantlar
  if (st.step === 'q_opts') {
    const opts = text.split('\n').map(x => x.trim()).filter(Boolean);
    if (opts.length < 2 || opts.length > 10) {
      bot.sendMessage(chatId, "⚠️ 2 dan 10 tagacha variant kerak. Har birini yangi qatorga yozing.");
      return true;
    }
    st.options = opts;
    st.step = 'q_correct';
    const rows = opts.map((o, i) => [{ text: `${String.fromCharCode(65 + i)}) ${trunc(o, 40)}`, callback_data: `a:correct:${i}` }]);
    bot.sendMessage(chatId, "✅ To'g'ri javobni tanlang:", { reply_markup: { inline_keyboard: rows } });
    return true;
  }

  // Yangi bo'lim nomi
  if (st.step === 'newsub_name') {
    const label = text;
    const key = slugify(label);
    const ok = questions.createSub(st.dir, dirLabel(st.dir), key, label);
    delete aStates[userId];
    bot.sendMessage(chatId, ok
      ? `✅ Yangi bo'lim yaratildi: ${dirLabel(st.dir)} → ${label}\nEndi unga savol qo'shishingiz mumkin.`
      : "⚠️ Bunday bo'lim allaqachon bor.");
    return true;
  }

  // Yangi yo'nalish — nom
  if (st.step === 'newdir_name') {
    const label = text.trim();
    if (label.length < 2 || label.length > 40) {
      bot.sendMessage(chatId, "⚠️ Nom 2 dan 40 belgigacha bo'lsin. Qaytadan yuboring yoki /bekor.");
      return true;
    }
    st.dirLabel = label;
    st.dirKey = slugify(label);
    if (!st.dirKey) st.dirKey = 'dir' + Date.now();
    st.step = 'newdir_emoji';
    bot.sendMessage(chatId, `Yo'nalish nomi: "${label}"\n\nEmoji yuboring (masalan: 🎨 🔍 📱) yoki /skip bossangiz default 📚 ishlatamiz:`);
    return true;
  }
  if (st.step === 'newdir_emoji') {
    const emoji = (text === '/skip' || text.toLowerCase() === 'yoq' || text.toLowerCase() === "yo'q")
      ? '📚'
      : text.trim().slice(0, 4); // emoji odatda 1-2 char, ehtiyot uchun 4
    const ok = storage.addDirection({ key: st.dirKey, label: st.dirLabel, emoji });
    delete aStates[userId];
    if (!ok) {
      bot.sendMessage(chatId, "⚠️ Bunday kalit bilan yo'nalish allaqachon bor. Boshqa nom bilan urinib ko'ring.");
      return true;
    }
    bot.sendMessage(chatId,
      `✅ Yangi yo'nalish qo'shildi: ${emoji} ${st.dirLabel}\n\n` +
      `Endi unga yangi bo'lim va savollar qo'shishingiz mumkin:\n` +
      `• "🆕 Yangi bo'lim" tugmasi yoki /bolim\n` +
      `• "➕ Savol qo'shish" tugmasi yoki /qush`);
    return true;
  }

  // Kanal qo'shish
  if (st.step === 'channel_add') {
    let ch = text;
    if (ch.startsWith('https://t.me/')) ch = '@' + ch.replace('https://t.me/', '').replace('/', '');
    else if (ch.startsWith('t.me/')) ch = '@' + ch.replace('t.me/', '').replace('/', '');
    else if (!ch.startsWith('@')) ch = '@' + ch;
    storage.addChannel(ch);
    delete aStates[userId];
    const chans = storage.getChannels();
    bot.sendMessage(chatId, `✅ Kanal qo'shildi: ${ch}\n\nJoriy kanallar:\n` +
      chans.map((c, i) => `${i + 1}. ${c}`).join('\n') +
      `\n\n⚠️ Bot o'sha kanalda ADMIN bo'lishi shart, aks holda obuna tekshiruvi ishlamaydi.`);
    return true;
  }

  return false;
}

module.exports = { isAdmin, openPanel, handleCallback, handleMessage, startAdd, startNewSub, startNewDir };
