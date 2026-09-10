'use strict';

require('dotenv').config();

const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN .env faylida topilmadi. .env.example dan nusxa oling.');
  process.exit(1);
}

// ADMIN_IDS: vergul bilan ajratilgan, bo'sh joylar tozalanadi.
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => Number(s))
  .filter((n) => Number.isInteger(n));

// Runtime data papkasi. Railway'da /app/data (Volume), lokalda ./data.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

// Bundled seed fayllari (repo ichida).
const SEED_DIR = path.join(__dirname, '..', 'seed');

function isAdmin(userId) {
  return ADMIN_IDS.includes(Number(userId));
}

module.exports = {
  BOT_TOKEN,
  ADMIN_IDS,
  DATA_DIR,
  SEED_DIR,
  isAdmin,
};
