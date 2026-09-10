'use strict';

const config = require('./config');

// chatId -> [{ role, text }]
const histories = new Map();

// Oddiy statistika
const stats = {
  startedAt: Date.now(),
  totalMessages: 0,
  users: new Set(),
};

function getHistory(chatId) {
  if (!histories.has(chatId)) histories.set(chatId, []);
  return histories.get(chatId);
}

function addUserMessage(chatId, text) {
  const h = getHistory(chatId);
  h.push({ role: 'user', text });
  trim(h);
}

function addModelMessage(chatId, text) {
  const h = getHistory(chatId);
  h.push({ role: 'model', text });
  trim(h);
}

// Tarixni belgilangan uzunlikda ushlab turamiz (token sarfini cheklash uchun)
function trim(h) {
  const max = Math.max(2, config.historyLimit);
  while (h.length > max) h.shift();
}

function resetHistory(chatId) {
  histories.delete(chatId);
}

function track(chatId) {
  stats.totalMessages += 1;
  stats.users.add(chatId);
}

function getStats() {
  const uptimeMin = Math.round((Date.now() - stats.startedAt) / 60000);
  return {
    totalMessages: stats.totalMessages,
    totalUsers: stats.users.size,
    uptimeMin,
  };
}

module.exports = {
  getHistory,
  addUserMessage,
  addModelMessage,
  resetHistory,
  track,
  getStats,
  // testlar uchun
  _histories: histories,
};
