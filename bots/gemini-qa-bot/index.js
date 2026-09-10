'use strict';

const { startBot } = require('./src/bot');

startBot();

// Kutilmagan xatolarda jarayon to'satdan o'chib qolmasligi uchun
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err && err.message ? err.message : err);
});
