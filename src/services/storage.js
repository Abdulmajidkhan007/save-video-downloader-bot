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
function writeJsonAtomic(filePath, data) {
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
function upsertUser(from) {
  const users = getUsers();
  const id = String(from.id);
  const now = new Date().toISOString();
  const existing = users[id];

  if (existing) {
    existing.firstName = from.first_name || existing.firstName || '';
    existing.username = from.username || existing.username || '';
    existing.lastActive = now;
  } else {
    users[id] = {
      firstName: from.first_name || '',
      username: from.username || '',
      joinedAt: now,
      downloads: 0,
      lastActive: now,
    };
  }
  saveUsers(users);
  // isNew — yangi foydalanuvchi ekanini bildiradi (adminlarga xabar uchun).
  return Object.assign({}, users[id], { isNew: !existing });
}

// Foydalanuvchining yuklashlar sonini oshiradi.
function incrementUserDownloads(userId) {
  const users = getUsers();
  const id = String(userId);
  if (users[id]) {
    users[id].downloads = (users[id].downloads || 0) + 1;
    users[id].lastActive = new Date().toISOString();
    saveUsers(users);
  }
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
  };
  saveGroups(groups);
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

function getGroupCount() {
  return Object.keys(getGroups()).length;
}

module.exports = {
  init,
  // users
  getUsers,
  getUser,
  upsertUser,
  incrementUserDownloads,
  getAllUserIds,
  getUserCount,
  getActiveTodayCount,
  getRecentUsers,
  // channels
  getChannels,
  addChannel,
  removeChannel,
  // groups
  getGroups,
  addGroup,
  removeGroup,
  getGroupCount,
  // stats
  getStats,
  recordDownload,
  recordMp3Download,
  recordMusicSearch,
};
