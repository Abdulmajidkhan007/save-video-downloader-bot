'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

function _path(name) { return path.join(DATA_DIR, name); }
function load(name, fallback) {
  try { return JSON.parse(fs.readFileSync(_path(name), 'utf8')); }
  catch { return fallback; }
}
function save(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(_path(name), JSON.stringify(data, null, 2));
}

// REQUIRED_CHANNELS env'idan boshlang'ich kanallar (faqat birinchi marta)
function _seedChannels() {
  const seed = (process.env.REQUIRED_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!seed.length) return [];
  return seed.map(s => {
    if (s.startsWith('@')) return { username: s.slice(1), title: s, id: null };
    const m = s.match(/^(-?\d+)(?::(.+))?$/);
    if (m) return { id: Number(m[1]), title: m[2] || `Channel ${m[1]}`, username: null };
    return null;
  }).filter(Boolean);
}

const state = {
  users:    load('users.json', {}),     // userId -> { code, name, username, joinedAt, welcome? }
  codes:    load('codes.json', {}),     // code -> userId
  sessions: load('sessions.json', {}),  // senderId -> targetId (faol "yozish")
  threads:  load('threads.json', {}),   // "chatId:mid" -> { sender, sourceMid }
  blocks:   load('blocks.json', {}),    // ownerId -> [senderId...]
  bans:     load('bans.json', {}),      // userId -> { at, by, reason? }
  blacklist: load('blacklist.json', {}), // global_blacklist: userId -> { at, by, reason }
  channels: load('channels.json', null),
  stats:    load('stats.json', { messages: 0, reports: 0 }),

  // faqat xotirada
  rateLimits: new Map(),                // userId -> [timestamp...]
  adminState: new Map(),                // adminId -> { stage, ctx }
  adminContact: new Map(),              // userId -> true ("admin bilan bog'lanish" navbatda)
};

// channels.json yo'q bo'lsa env'dan seed
if (state.channels === null) {
  state.channels = _seedChannels();
  save('channels.json', state.channels);
}

const persist = {
  users:    () => { save('users.json', state.users); save('codes.json', state.codes); },
  sessions: () => save('sessions.json', state.sessions),
  threads:  () => save('threads.json', state.threads),
  blocks:   () => save('blocks.json', state.blocks),
  bans:     () => save('bans.json', state.bans),
  blacklist: () => save('blacklist.json', state.blacklist),
  channels: () => save('channels.json', state.channels),
  stats:    () => save('stats.json', state.stats),
};

function trimThreads() {
  const keys = Object.keys(state.threads);
  if (keys.length > 5000) {
    for (const k of keys.slice(0, keys.length - 5000)) delete state.threads[k];
  }
}

function genCode() {
  let code;
  do { code = crypto.randomBytes(7).toString('hex'); } while (state.codes[code]);
  return code;
}

function ensureUser(from) {
  const id = String(from.id);
  if (!state.users[id]) {
    const code = genCode();
    state.users[id] = {
      code,
      name: [from.first_name, from.last_name].filter(Boolean).join(' '),
      username: from.username || null,
      joinedAt: new Date().toISOString(),
    };
    state.codes[code] = id;
    persist.users();
  }
  return state.users[id];
}

module.exports = { state, persist, trimThreads, genCode, ensureUser, DATA_DIR };
