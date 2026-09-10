// ============================================================
//  QUIZ BOT — kirish nuqtasi
//  Ishga tushirish:  node index.js
// ============================================================
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const storage = require('./src/storage');
const handlers = require('./src/handlers');
const groupQuiz = require('./src/groupQuiz');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('❌ BOT_TOKEN topilmadi. .env faylini tekshiring.');
  process.exit(1);
}

// Birinchi ishga tushganda majburiy kanallarni .env dan ko'chiramiz (keyin admin boshqaradi)
storage.seedChannels(config.REQUIRED_CHANNELS);
// Yo'nalishlarni config'dan seed qilamiz (keyin hamma yangi qo'sha oladi)
storage.seedDirections(config.DIRECTIONS, config.DIRECTION_EMOJI);

const bot = new TelegramBot(TOKEN, { polling: true });

handlers.register(bot);

// Botning o'z ID'sini olamiz (guruhda admin tekshiruvi uchun kerak)
bot.getMe().then((me) => {
  groupQuiz.setBotId(me.id);
  console.log('🤖 Bot: @' + me.username + ' ishga tushdi...');
}).catch((e) => {
  console.error('getMe xato:', e.message);
  console.log('🤖 Quiz Bot ishga tushdi...');
});

bot.on('polling_error', (e) => console.error('polling_error:', e.code || e.message));
