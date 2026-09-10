// ============================================================
//  Ma'lumotlarni saqlash (JSON fayllar) — Termux uchun qulay
//  data/users.json    -> foydalanuvchilar
//  data/results.json  -> test natijalari tarixi
//  data/groups.json   -> bot qo'shilgan guruhlar
// ============================================================
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJson(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---------- Foydalanuvchilar ----------
function getUsers() { return readJson(USERS_FILE, {}); }
function getUser(id) { return getUsers()[id] || null; }
function upsertUser(user) {
  const users = getUsers();
  users[user.id] = { ...(users[user.id] || {}), ...user };
  writeJson(USERS_FILE, users);
  return users[user.id];
}

// ---------- Natijalar ----------
function getResults() { return readJson(RESULTS_FILE, []); }
function addResult(result) {
  const results = getResults();
  results.push(result);
  writeJson(RESULTS_FILE, results);
}
function getUserResults(userId) {
  return getResults().filter(r => r.userId === userId);
}

// ---------- Guruhlar (bot qo'shilgan) ----------
function getGroups() { return readJson(GROUPS_FILE, {}); }
function upsertGroup(g) {
  const groups = getGroups();
  groups[g.id] = { ...(groups[g.id] || {}), ...g };
  writeJson(GROUPS_FILE, groups);
}
function removeGroup(id) {
  const groups = getGroups();
  delete groups[id];
  writeJson(GROUPS_FILE, groups);
}

// ---------- Majburiy kanallar (admin boshqaradi) ----------
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');
function getChannels() { return readJson(CHANNELS_FILE, []); }
function seedChannels(seed) { if (!fs.existsSync(CHANNELS_FILE)) writeJson(CHANNELS_FILE, seed || []); }
function addChannel(ch) { const a = getChannels(); if (!a.includes(ch)) a.push(ch); writeJson(CHANNELS_FILE, a); return a; }
function removeChannelAt(index) { const a = getChannels(); if (index >= 0 && index < a.length) a.splice(index, 1); writeJson(CHANNELS_FILE, a); return a; }

// ---------- Yo'nalishlar (hamma qo'sha oladi) ----------
const DIRECTIONS_FILE = path.join(DATA_DIR, 'directions.json');
function getDirections() { return readJson(DIRECTIONS_FILE, []); }
function seedDirections(seed, emojiMap) {
  if (fs.existsSync(DIRECTIONS_FILE)) return;
  const arr = (seed || []).map(d => ({
    key: d.key,
    label: d.label,
    emoji: (emojiMap && emojiMap[d.key]) || d.emoji || '📚'
  }));
  writeJson(DIRECTIONS_FILE, arr);
}
function addDirection(dir) {
  const all = getDirections();
  if (all.some(d => d.key === dir.key)) return false; // mavjud
  all.push({ key: dir.key, label: dir.label, emoji: dir.emoji || '📚' });
  writeJson(DIRECTIONS_FILE, all);
  return true;
}
function getDirectionEmoji(key) {
  const d = getDirections().find(x => x.key === key);
  return d ? d.emoji : '📚';
}

module.exports = {
  getUsers, getUser, upsertUser,
  getResults, addResult, getUserResults,
  getGroups, upsertGroup, removeGroup,
  getChannels, seedChannels, addChannel, removeChannelAt,
  getDirections, seedDirections, addDirection, getDirectionEmoji
};
