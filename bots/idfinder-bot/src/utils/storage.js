'use strict';

const fs = require('fs');
const path = require('path');

const { DATA_DIR, SEED_DIR } = require('../config');

// Boshqariladigan JSON fayllar va ularning standart (bo'sh) qiymatlari.
const FILES = {
  users: { name: 'users.json', fallback: [] },
  channels: { name: 'channels.json', fallback: [] },
  stats: {
    name: 'stats.json',
    fallback: {
      searches: { by_id: 0, by_username: 0, by_phone: 0 },
      getId: { channel: 0, group: 0, user: 0, forward: 0 },
      inline: { self: 0, by_id: 0, by_username: 0 },
    },
  },
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Birinchi ishga tushganda: DATA_DIR yaratiladi va seed fayllari ko'chiriladi
// (faqat agar mavjud bo'lmasa).
function init() {
  ensureDir(DATA_DIR);

  for (const key of Object.keys(FILES)) {
    const { name, fallback } = FILES[key];
    const target = path.join(DATA_DIR, name);
    if (fs.existsSync(target)) continue;

    const seed = path.join(SEED_DIR, name);
    if (fs.existsSync(seed)) {
      fs.copyFileSync(seed, target);
      console.log(`📦 Seed ko'chirildi: ${name} -> ${DATA_DIR}`);
    } else {
      fs.writeFileSync(target, JSON.stringify(fallback, null, 2));
      console.log(`📄 Standart fayl yaratildi: ${name}`);
    }
  }
}

function filePath(key) {
  const meta = FILES[key];
  if (!meta) throw new Error(`Noma'lum storage kaliti: ${key}`);
  return path.join(DATA_DIR, meta.name);
}

function read(key) {
  const meta = FILES[key];
  if (!meta) throw new Error(`Noma'lum storage kaliti: ${key}`);
  const target = filePath(key);
  try {
    const raw = fs.readFileSync(target, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`⚠️  ${meta.name} o'qishda xato, fallback ishlatildi:`, err.message);
    // JSON buzilgan bo'lsa fallback nusxa qaytariladi.
    return JSON.parse(JSON.stringify(meta.fallback));
  }
}

function write(key, data) {
  const target = filePath(key);
  // Atomik yozish: avval .tmp ga, keyin rename.
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, target);
}

// ---- Users helpers ----

// Foydalanuvchini qo'shadi yoki yangilaydi. Yangi bo'lsa true qaytaradi.
function upsertUser(user) {
  const users = read('users');
  const existing = users.find((u) => u.id === user.id);
  if (existing) {
    existing.username = user.username;
    existing.first_name = user.first_name;
    write('users', users);
    return false;
  }
  users.push({
    id: user.id,
    username: user.username || null,
    first_name: user.first_name || null,
    joined_at: new Date().toISOString(),
  });
  write('users', users);
  return true;
}

function getUsers() {
  return read('users');
}

// ---- Channels helpers ----

function getChannels() {
  return read('channels');
}

// Kanal qo'shadi. Format: { id, title, username }.
function addChannel(channel) {
  const channels = read('channels');
  if (channels.some((c) => String(c.id) === String(channel.id))) {
    return false; // allaqachon mavjud
  }
  channels.push(channel);
  write('channels', channels);
  return true;
}

function removeChannel(id) {
  const channels = read('channels');
  const next = channels.filter((c) => String(c.id) !== String(id));
  if (next.length === channels.length) return false;
  write('channels', next);
  return true;
}

// ---- Stats helpers ----

function incStat(group, key) {
  const stats = read('stats');
  if (!stats[group]) stats[group] = {};
  stats[group][key] = (stats[group][key] || 0) + 1;
  write('stats', stats);
}

function getStats() {
  return read('stats');
}

module.exports = {
  init,
  read,
  write,
  upsertUser,
  getUsers,
  getChannels,
  addChannel,
  removeChannel,
  incStat,
  getStats,
};
