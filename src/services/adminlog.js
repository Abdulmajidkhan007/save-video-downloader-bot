'use strict';

const fs = require('fs');
const path = require('path');
const { config } = require('../config');

// Barcha admin harakatlari (broadcast, kanal qo'shish/o'chirish) ni yozib boramiz.
// data/admin_log.json — massiv, oxirgi 500 ta yozuv saqlanadi.

const MAX_ENTRIES = 500;

function readLog() {
  try {
    if (!fs.existsSync(config.FILES.adminLog)) return [];
    const raw = fs.readFileSync(config.FILES.adminLog, 'utf8');
    if (!raw.trim()) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (err) {
    console.error('[adminlog] o\'qishda xato:', err.message);
    return [];
  }
}

function writeLog(entries) {
  try {
    const dir = path.dirname(config.FILES.adminLog);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${config.FILES.adminLog}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(entries, null, 2), 'utf8');
    fs.renameSync(tmp, config.FILES.adminLog);
  } catch (err) {
    console.error('[adminlog] yozishda xato:', err.message);
  }
}

// action: 'broadcast' | 'channel_add' | 'channel_remove' ...
// admin: { id, name }, detail: matn
function log(action, admin, detail) {
  const entries = readLog();
  entries.push({
    at: new Date().toISOString(),
    action,
    adminId: admin ? String(admin.id) : '',
    adminName: admin ? admin.name || '' : '',
    detail: detail || '',
  });
  writeLog(entries.slice(-MAX_ENTRIES));
}

function getRecent(limit = 10) {
  const entries = readLog();
  return entries.slice(-limit).reverse();
}

module.exports = { log, getRecent };
