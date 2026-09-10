'use strict';

const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const state = require('./state');
const rateLimiter = require('./rateLimit');
const { askGemini } = require('./gemini');
const h = require('./handlers');

function startBot() {
  const bot = new TelegramBot(config.telegramToken, { polling: true });

  // "send" abstraksiyasi — handlerlar shu orqali xabar yuboradi
  const send = {
    sendMessage: (chatId, text) => bot.sendMessage(chatId, text),
    sendChatAction: (chatId, action) => bot.sendChatAction(chatId, action),
  };

  const deps = { send, ask: askGemini, state, rateLimiter, config };

  bot.onText(/^\/start\b/, (msg) => h.handleStart({ chatId: msg.chat.id, send }));
  bot.onText(/^\/help\b/, (msg) => h.handleHelp({ chatId: msg.chat.id, send }));
  bot.onText(/^\/reset\b/, (msg) => h.handleReset({ chatId: msg.chat.id, send, state }));
  bot.onText(/^\/stats\b/, (msg) =>
    h.handleStats({ chatId: msg.chat.id, fromId: msg.from && msg.from.id, send, state, config })
  );

  // Buyruq bo'lmagan oddiy matn — savol sifatida Gemini'ga yuboriladi
  bot.on('message', (msg) => {
    if (!msg.text) {
      bot.sendMessage(msg.chat.id, "Hozircha faqat matnli savollarni qabul qilaman. 🙂");
      return;
    }
    if (msg.text.startsWith('/')) return; // buyruqlar yuqorida ishlangan
    h.handleQuestion({ chatId: msg.chat.id, text: msg.text, deps });
  });

  bot.on('polling_error', (err) => {
    console.error('[polling] xato:', err && err.message ? err.message : err);
  });

  console.log(`Bot ishga tushdi ✅  Model: ${config.geminiModel}`);
  return bot;
}

module.exports = { startBot };
