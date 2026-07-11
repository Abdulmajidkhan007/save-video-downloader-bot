'use strict';

const fs = require('fs');
const path = require('path');
const { config } = require('../config');

// ---- Ichki yordamchi funksiyalar ----------------------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Atomik yozish: avval .tmp faylga yozamiz, keyin rename qilamiz.
// Bu yozish jarayonida crash bo'lsa fayl buzilmasligini kafolatlaydi.
// Har yozishdan oldin DATA_DIR (va maqsad papka) mavjudligini kafolatlaymiz —
// Railway volume qayta ulanib papka yo'qolsa ham yozish ishlashi uchun.
function writeJsonAtomic(filePath, data) {
  ensureDir(config.DATA_DIR);
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[storage] JSON o'qishda xato (${filePath}):`, err.message);
    return fallback;
  }
}

// ---- Boshlang'ich holat --------------------------------------------------

const DEFAULTS = {
  users: {},
  channels: [], // [{ id, title, username, addedAt }]
  groups: {}, // { "chatId": { title, addedBy, addedByName, membersCount, addedAt } }
  stats: {
    totalDownloads: 0,
    mp3Downloads: 0,
    musicSearches: 0,
    byPlatform: {},
    daily: {}, // { "2026-07-10": 12 }
  },
  settings: {
    autoForward: true, // avto-tarqatish yoniq/o'chiq
  },
};

function init() {
  ensureDir(config.DATA_DIR);
  ensureDir(config.DOWNLOADS_DIR);

  if (!fs.existsSync(config.FILES.users)) {
    writeJsonAtomic(config.FILES.users, DEFAULTS.users);
  }
  if (!fs.existsSync(config.FILES.channels)) {
    writeJsonAtomic(config.FILES.channels, DEFAULTS.channels);
  }
  if (!fs.existsSync(config.FILES.groups)) {
    writeJsonAtomic(config.FILES.groups, DEFAULTS.groups);
  }
  if (!fs.existsSync(config.FILES.stats)) {
    writeJsonAtomic(config.FILES.stats, DEFAULTS.stats);
  }
  if (!fs.existsSync(config.FILES.settings)) {
    writeJsonAtomic(config.FILES.settings, DEFAULTS.settings);
  }

  seedInitialChannels();
}

// INITIAL_CHANNELS env'dan majburiy obuna kanallarini seed qiladi.
// FAQAT channels.json bo'sh yoki yo'q bo'lsa — mavjud ma'lumot ustidan yozilmaydi.
function seedInitialChannels() {
  const initial = config.INITIAL_CHANNELS || [];
  if (!initial.length) return;
  const current = getChannels();
  if (current.length > 0) return; // mavjud kanallar bor — tegmaymiz

  const seeded = initial.map((username) => ({
    id: `@${username}`,
    title: '',
    username,
    addedAt: new Date().toISOString(),
  }));
  saveChannels(seeded);
  console.log(
    `✅ INITIAL_CHANNELS seed qilindi (${seeded.length} ta): ` +
      seeded.map((c) => '@' + c.username).join(', ')
  );
}

// ---- Users ---------------------------------------------------------------

function getUsers() {
  return readJson(config.FILES.users, {});
}

function saveUsers(users) {
  writeJsonAtomic(config.FILES.users, users);
}

function getUser(userId) {
  const users = getUsers();
  return users[String(userId)] || null;
}

// Foydalanuvchini ro'yxatga qo'shadi yoki mavjudini yangilaydi.
// source: 'private' (/start yoki shaxsiy chat) yoki 'group' (faqat guruhda ko'rilgan).
// 'private' har doim 'group' dan ustun — private user hech qachon group'ga tushmaydi.
function upsertUser(from, source) {
  const users = getUsers();
  const id = String(from.id);
  const now = new Date().toISOString();
  const existing = users[id];

  if (existing) {
    existing.firstName = from.first_name || existing.firstName || '';

    // username o'zgargan bo'lsa — tarixni yangilaymiz (oxirgi 3 tasi)
    if (from.username && from.username !== existing.username) {
      existing.usernameHistory = existing.usernameHistory || [];
      if (existing.username) {
        existing.usernameHistory.push(existing.username);
        existing.usernameHistory = existing.usernameHistory.slice(-3);
      }
      existing.username = from.username;
    } else if (from.username) {
      existing.username = from.username;
    }

    if (from.language_code) existing.languageCode = from.language_code;
    if (typeof from.is_premium === 'boolean') existing.isPremium = from.is_premium;

    // source'ni faqat yuqoriga ko'taramiz: group → private, lekin teskarisiga emas
    if (source === 'private') existing.source = 'private';
    else if (source === 'group' && !existing.source) existing.source = 'group';

    existing.lastActive = now;
  } else {
    users[id] = {
      firstName: from.first_name || '',
      username: from.username || '',
      usernameHistory: [],
      languageCode: from.language_code || '',
      isPremium: Boolean(from.is_premium),
      source: source || 'private',
      blocked: false,
      firstSeen: now,
      joinedAt: now,
      downloads: 0,
      downloadsByPlatform: {},
      // Referral maydonlari
      referredBy: null, // kim taklif qilgan (bir marta yoziladi)
      referrals: 0, // nechta odam taklif qilgan
      points: 0, // referral ballari
      lastActive: now,
    };
  }
  saveUsers(users);
  // isNew — yangi foydalanuvchi ekanini bildiradi (adminlarga xabar uchun).
  return Object.assign({}, users[id], { isNew: !existing });
}

// Foydalanuvchining yuklashlar sonini oshiradi (platforma bo'yicha ham).
function incrementUserDownloads(userId, platform) {
  const users = getUsers();
  const id = String(userId);
  if (users[id]) {
    users[id].downloads = (users[id].downloads || 0) + 1;
    if (platform) {
      users[id].downloadsByPlatform = users[id].downloadsByPlatform || {};
      users[id].downloadsByPlatform[platform] =
        (users[id].downloadsByPlatform[platform] || 0) + 1;
    }
    users[id].lastActive = new Date().toISOString();
    saveUsers(users);
  }
}

// Foydalanuvchiga blocked belgisi qo'yish/olib tashlash.
function setUserBlocked(userId, blocked) {
  const users = getUsers();
  const id = String(userId);
  if (users[id]) {
    users[id].blocked = Boolean(blocked);
    saveUsers(users);
  }
}

// Broadcast uchun: faqat 'private' va bloklanmagan foydalanuvchilar.
function getPrivateUserIds() {
  const users = getUsers();
  return Object.keys(users).filter(
    (id) => users[id].source === 'private' && !users[id].blocked
  );
}

// Faqat guruh orqali ko'rilgan foydalanuvchilar soni.
function getGroupSeenCount() {
  const users = getUsers();
  return Object.values(users).filter((u) => u.source === 'group').length;
}

function getPrivateCount() {
  const users = getUsers();
  return Object.values(users).filter((u) => u.source === 'private').length;
}

// ID yoki @username bo'yicha foydalanuvchi qidirish.
function findUser(query) {
  const users = getUsers();
  const q = String(query).trim().replace(/^@/, '').toLowerCase();
  // ID bo'yicha
  if (users[q]) return { id: q, ...users[q] };
  // username bo'yicha
  for (const [id, u] of Object.entries(users)) {
    if (u.username && u.username.toLowerCase() === q) return { id, ...u };
  }
  return null;
}

function getAllUserIds() {
  return Object.keys(getUsers());
}

function getUserCount() {
  return Object.keys(getUsers()).length;
}

// Bugun faol bo'lgan foydalanuvchilar soni
function getActiveTodayCount() {
  const users = getUsers();
  const today = new Date().toISOString().slice(0, 10);
  let count = 0;
  for (const u of Object.values(users)) {
    if (u.lastActive && u.lastActive.slice(0, 10) === today) count += 1;
  }
  return count;
}

// Oxirgi N ta yangi foydalanuvchi (joinedAt bo'yicha)
function getRecentUsers(limit = 10) {
  const users = getUsers();
  return Object.entries(users)
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))
    .slice(0, limit);
}

// ---- Referral ------------------------------------------------------------

// Referralni qo'llaydi (atomik). Aldashning oldini olish shartlari shu yerda
// qat'iy tekshiriladi:
//  - referrer o'zini taklif qila olmaydi
//  - referrer bazada mavjud bo'lishi kerak
//  - yangi user bazada bo'lishi kerak
//  - yangi user avval kimgadir referral bo'lmagan bo'lishi kerak (referredBy bo'sh)
// Muvaffaqiyatda referrer'ga +1 ball/referral, yangi user'ga referredBy yoziladi.
function applyReferral(referrerId, newUserId) {
  const rid = String(referrerId);
  const nid = String(newUserId);
  if (rid === nid) return { ok: false, reason: 'self' };

  const users = getUsers();
  if (!users[rid]) return { ok: false, reason: 'no_referrer' };
  if (!users[nid]) return { ok: false, reason: 'no_newuser' };
  if (users[nid].referredBy) return { ok: false, reason: 'already' };

  users[nid].referredBy = rid;
  users[rid].referrals = (users[rid].referrals || 0) + 1;
  users[rid].points = (users[rid].points || 0) + 1;
  saveUsers(users);

  return {
    ok: true,
    referrerPoints: users[rid].points,
    referrerReferrals: users[rid].referrals,
    referrer: { id: rid, ...users[rid] },
  };
}

// Top N referrer (points bo'yicha, faqat points>0).
function getReferralLeaderboard(limit = 10) {
  const users = getUsers();
  return Object.entries(users)
    .map(([id, u]) => ({ id, ...u }))
    .filter((u) => (u.points || 0) > 0)
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, limit);
}

// Referral orqali kelgan (referredBy to'ldirilgan) foydalanuvchilar soni.
function getReferredCount() {
  const users = getUsers();
  return Object.values(users).filter((u) => u.referredBy).length;
}

// ---- Channels ------------------------------------------------------------

function getChannels() {
  return readJson(config.FILES.channels, []);
}

function saveChannels(channels) {
  writeJsonAtomic(config.FILES.channels, channels);
}

function addChannel(channel) {
  const channels = getChannels();
  const key = String(channel.id || channel.username || '').toLowerCase();
  const exists = channels.some(
    (c) => String(c.id).toLowerCase() === key ||
      String(c.username || '').toLowerCase() === key
  );
  if (exists) return false;
  channels.push({
    id: channel.id,
    title: channel.title || '',
    username: channel.username || '',
    addedAt: new Date().toISOString(),
  });
  saveChannels(channels);
  return true;
}

function removeChannel(idOrUsername) {
  const channels = getChannels();
  const key = String(idOrUsername).toLowerCase().replace(/^@/, '');
  const filtered = channels.filter(
    (c) =>
      String(c.id).toLowerCase() !== key &&
      String(c.username || '').toLowerCase().replace(/^@/, '') !== key
  );
  if (filtered.length === channels.length) return false;
  saveChannels(filtered);
  return true;
}

// ---- Stats ---------------------------------------------------------------

function getStats() {
  return readJson(config.FILES.stats, {
    totalDownloads: 0,
    mp3Downloads: 0,
    musicSearches: 0,
    byPlatform: {},
    daily: {},
  });
}

function saveStats(stats) {
  writeJsonAtomic(config.FILES.stats, stats);
}

// Muvaffaqiyatli yuklashni statistikaga yozadi.
function recordDownload(platform) {
  const stats = getStats();
  stats.totalDownloads = (stats.totalDownloads || 0) + 1;

  stats.byPlatform = stats.byPlatform || {};
  stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;

  const today = new Date().toISOString().slice(0, 10);
  stats.daily = stats.daily || {};
  stats.daily[today] = (stats.daily[today] || 0) + 1;

  saveStats(stats);
  return stats.totalDownloads;
}

// MP3 yuklashlar hisoblagichi.
function recordMp3Download() {
  const stats = getStats();
  stats.mp3Downloads = (stats.mp3Downloads || 0) + 1;
  saveStats(stats);
}

// Musiqa qidiruvlar hisoblagichi.
function recordMusicSearch() {
  const stats = getStats();
  stats.musicSearches = (stats.musicSearches || 0) + 1;
  saveStats(stats);
}

// ---- Groups --------------------------------------------------------------

function getGroups() {
  return readJson(config.FILES.groups, {});
}

function saveGroups(groups) {
  writeJsonAtomic(config.FILES.groups, groups);
}

function addGroup(chat, addedBy, membersCount) {
  const groups = getGroups();
  const id = String(chat.id);
  const prev = groups[id];
  groups[id] = {
    title: chat.title || (prev && prev.title) || '',
    addedBy: addedBy ? String(addedBy.id) : (prev && prev.addedBy) || '',
    addedByName: addedBy
      ? addedBy.first_name || addedBy.username || ''
      : (prev && prev.addedByName) || '',
    membersCount: membersCount || (prev && prev.membersCount) || 0,
    addedAt: prev ? prev.addedAt : new Date().toISOString(),
    // Ko'rilgan faol a'zolar re-add'da ham saqlanadi
    seenMembers: (prev && prev.seenMembers) || [],
  };
  saveGroups(groups);
}

// Guruhda ko'rilgan (faol) a'zoni qayd qiladi.
// MUHIM: Telegram Bot API guruh a'zolarining TO'LIQ ro'yxatini bermaydi —
// faqat getChatMemberCount (son) mavjud. Shuning uchun bot faqat O'ZI KO'RGAN
// (yozgan yoki qo'shilgan) a'zolarni yig'adi. Bu "faol a'zolar", to'liq emas.
function recordSeenMember(chat, from) {
  if (!from || from.is_bot) return; // botlarni yozmaymiz
  const groups = getGroups();
  const id = String(chat.id);
  if (!groups[id]) {
    groups[id] = {
      title: chat.title || '',
      addedBy: '',
      addedByName: '',
      membersCount: 0,
      addedAt: new Date().toISOString(),
      seenMembers: [],
    };
  }
  if (!Array.isArray(groups[id].seenMembers)) groups[id].seenMembers = [];

  const now = new Date().toISOString();
  const uid = String(from.id);
  const existing = groups[id].seenMembers.find((m) => String(m.id) === uid);
  if (existing) {
    existing.lastSeen = now;
    if (from.first_name) existing.firstName = from.first_name;
    if (from.username) existing.username = from.username;
  } else {
    groups[id].seenMembers.push({
      id: uid,
      firstName: from.first_name || '',
      username: from.username || '',
      lastSeen: now,
    });
  }
  saveGroups(groups);
}

function getGroup(chatId) {
  const groups = getGroups();
  return groups[String(chatId)] || null;
}

function getSeenMembers(chatId) {
  const g = getGroup(chatId);
  return (g && Array.isArray(g.seenMembers) && g.seenMembers) || [];
}

function removeGroup(chatId) {
  const groups = getGroups();
  const id = String(chatId);
  if (groups[id]) {
    delete groups[id];
    saveGroups(groups);
    return true;
  }
  return false;
}

// Broadcast paytida guruhga yuborib bo'lmasa (bot chiqarilgan/xato) — left=true.
// Yozuv o'chirilmaydi, faqat belgilanadi; keyingi broadcastlarda o'tkaziladi.
function markGroupLeft(chatId) {
  const groups = getGroups();
  const id = String(chatId);
  if (groups[id]) {
    groups[id].left = true;
    saveGroups(groups);
  }
}

function getGroupCount() {
  // Faol (chiqarilmagan) guruhlar soni
  return Object.values(getGroups()).filter((g) => !g.left).length;
}

// Broadcast uchun: faol (left bo'lmagan) guruh ID lari.
function getBroadcastGroupIds() {
  const groups = getGroups();
  return Object.keys(groups).filter((id) => !groups[id].left);
}

// ---- Settings ------------------------------------------------------------

function getSettings() {
  return readJson(config.FILES.settings, { autoForward: true });
}

function setSetting(key, value) {
  const s = getSettings();
  s[key] = value;
  writeJsonAtomic(config.FILES.settings, s);
  return s;
}

// ---- Sent posts (avto-tarqatish anti-dublikat) ---------------------------

const SENT_POSTS_MAX = 2000;

function getSentPosts() {
  return readJson(config.FILES.sentPosts, {});
}

// Post allaqachon tarqatilganmi (key = "<chatId>:<messageId>").
function isPostSent(key) {
  const sent = getSentPosts();
  return Boolean(sent[key]);
}

// Postni "tarqatilgan" deb belgilaydi. Ro'yxat SENT_POSTS_MAX bilan cheklanadi.
function markPostSent(key) {
  const sent = getSentPosts();
  sent[key] = Date.now();
  const keys = Object.keys(sent);
  if (keys.length > SENT_POSTS_MAX) {
    // eng eski yozuvlarni olib tashlaymiz
    keys
      .sort((a, b) => sent[a] - sent[b])
      .slice(0, keys.length - SENT_POSTS_MAX)
      .forEach((k) => delete sent[k]);
  }
  writeJsonAtomic(config.FILES.sentPosts, sent);
}

module.exports = {
  init,
  // users
  getUsers,
  getUser,
  upsertUser,
  incrementUserDownloads,
  setUserBlocked,
  getPrivateUserIds,
  getGroupSeenCount,
  getPrivateCount,
  findUser,
  getAllUserIds,
  getUserCount,
  getActiveTodayCount,
  getRecentUsers,
  // referral
  applyReferral,
  getReferralLeaderboard,
  getReferredCount,
  // channels
  getChannels,
  addChannel,
  removeChannel,
  // groups
  getGroups,
  getGroup,
  addGroup,
  removeGroup,
  markGroupLeft,
  getGroupCount,
  getBroadcastGroupIds,
  recordSeenMember,
  getSeenMembers,
  // stats
  getStats,
  recordDownload,
  recordMp3Download,
  recordMusicSearch,
  // settings + sent posts
  getSettings,
  setSetting,
  isPostSent,
  markPostSent,
};
