'use strict';

const { config } = require('../config');

// notifyAdmins — barcha ADMIN_IDS ga xabar yuboradi, xatolarni yutadi.
// bot instansiyasi bot.js ishga tushganda setBot() orqali beriladi.

let botRef = null;

function setBot(bot) {
  botRef = bot;
}

async function notifyAdmins(text, options = {}) {
  if (!botRef) return;
  for (const adminId of config.ADMIN_IDS) {
    try {
      await botRef.sendMessage(adminId, text, { parse_mode: 'HTML', ...options });
    } catch (err) {
      // Admin botni bloklagan yoki xat bo'lsa — jimgina o'tkazamiz.
      console.error(`[notify] admin ${adminId} ga yuborilmadi:`, err.message);
    }
  }
}

module.exports = { setBot, notifyAdmins };
