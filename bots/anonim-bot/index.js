'use strict';
try { require('dotenv').config(); } catch {}

const TelegramBot = require('node-telegram-bot-api');
const util = require('./src/util');
const handlers = require('./src/handlers');
const { DATA_DIR } = require('./src/state');

async function main() {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN topilmadi. .env faylga BOT_TOKEN=... qo'shing.");
    process.exit(1);
  }
  const bot = new TelegramBot(BOT_TOKEN, {
    polling: {
      params: {
        timeout: 30,
        allowed_updates: ['message', 'callback_query', 'chat_member', 'my_chat_member'],
      },
    },
  });
  const me = await bot.getMe();
  util.setBotUsername(me.username);
  handlers.registerHandlers(bot);

  // Telegram menyusiga slash-komandalarni o'rnatish (scope bilan)
  try {
    // Hamma uchun: /admin = admin bilan bog'lanish
    await bot.setMyCommands([
      { command: 'start',   description: 'Botni boshlash' },
      { command: 'welcome', description: 'Maxsus salomlashuv matni' },
      { command: 'blocks',  description: "Bloklanganlar ro'yxati" },
      { command: 'admin',   description: 'Admin bilan bog\'lanish' },
    ]);
    // Faqat admin chatida: /anoner = panel ( /admin esa ko'rinmaydi )
    if (process.env.ADMIN_ID) {
      await bot.setMyCommands(
        [
          { command: 'start',   description: 'Botni boshlash' },
          { command: 'welcome', description: 'Maxsus salomlashuv matni' },
          { command: 'blocks',  description: "Bloklanganlar ro'yxati" },
          { command: 'anoner',  description: 'Admin panel' },
        ],
        { scope: { type: 'chat', chat_id: Number(process.env.ADMIN_ID) } }
      );
    }
  } catch (e) { console.error('setMyCommands:', e.message); }

  console.log(`✅ @${me.username} ishga tushdi (DATA_DIR=${DATA_DIR})`);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = handlers;
