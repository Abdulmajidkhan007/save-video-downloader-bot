'use strict';

// .env faylni yuklaymiz (faqat lokalda; Railway'da env o'zgaruvchilar panel orqali beriladi)
require('dotenv').config({ quiet: true });

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`[config] XATO: "${name}" o'zgaruvchisi berilmagan. .env faylga yoki Railway Variables'ga qo'shing.`);
    process.exit(1);
  }
  return v.trim();
}

function num(name, def) {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

const config = {
  telegramToken: required('TELEGRAM_TOKEN'),
  geminiApiKey: required('GEMINI_API_KEY'),

  // Model nomini env orqali o'zgartirish mumkin (yangi nom chiqsa, faqat shuni yangilaysan)
  geminiModel: (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),

  // Botning xulqi (persona). O'zing xohlagancha o'zgartir.
  systemPrompt: (process.env.SYSTEM_PROMPT ||
    "Sen foydali yordamchisan. Foydalanuvchining savollariga aniq, qisqa va tushunarli javob ber. " +
    "Foydalanuvchi qaysi tilda yozsa, o'sha tilda javob ber.").trim(),

  temperature: num('TEMPERATURE', 0.7),
  maxOutputTokens: num('MAX_OUTPUT_TOKENS', 1024),

  // Suhbat konteksti: oxirgi necha xabar eslab qolinsin (juft son tavsiya: savol+javob)
  historyLimit: num('HISTORY_LIMIT', 10),

  // Rate limit: bir foydalanuvchi WINDOW_MS ichida nechta so'rov yubora oladi
  rateLimitMax: num('RATE_LIMIT_MAX', 5),
  rateLimitWindowMs: num('RATE_LIMIT_WINDOW_MS', 60 * 1000),

  // Ixtiyoriy: admin Telegram ID (stats uchun). Bo'sh bo'lsa /stats hammaga yopiq.
  adminId: (process.env.ADMIN_ID || '').trim(),
};

module.exports = config;
