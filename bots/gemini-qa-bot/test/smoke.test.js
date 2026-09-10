'use strict';

// MUHIM: env'ni modullarni require qilishdan OLDIN o'rnatamiz (config require vaqtida o'qiydi)
process.env.TELEGRAM_TOKEN = 'test-token';
process.env.GEMINI_API_KEY = 'test-key';
process.env.HISTORY_LIMIT = '4';
process.env.RATE_LIMIT_MAX = '2';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.ADMIN_ID = '999';

const assert = require('assert');

let passed = 0;
function ok(name) { console.log('  ✓ ' + name); passed += 1; }
function run(name, fn) {
  try { fn(); ok(name); }
  catch (e) { console.error('  ✗ ' + name + '  -> ' + (e && e.message)); process.exitCode = 1; }
}
async function runAsync(name, fn) {
  try { await fn(); ok(name); }
  catch (e) { console.error('  ✗ ' + name + '  -> ' + (e && e.message)); process.exitCode = 1; }
}

function makeSend() {
  const calls = { messages: [], actions: [] };
  return {
    calls,
    sendMessage: async (chatId, text) => { calls.messages.push({ chatId, text }); },
    sendChatAction: async (chatId, action) => { calls.actions.push({ chatId, action }); },
  };
}

(async function main() {
  console.log('Smoke testlar boshlandi\n');

  // --- 1. Modullar yuklanadi (require) ---
  const config = require('../src/config');
  const state = require('../src/state');
  const rateLimiter = require('../src/rateLimit');
  const gemini = require('../src/gemini');
  const h = require('../src/handlers');

  console.log('Modullar:');
  run('config yuklandi va majburiy maydonlar bor', () => {
    assert.strictEqual(config.telegramToken, 'test-token');
    assert.strictEqual(config.geminiApiKey, 'test-key');
    assert.ok(config.geminiModel);
    assert.ok(config.systemPrompt.length > 0);
  });
  run('gemini.askGemini funksiya sifatida eksport qilingan', () => {
    assert.strictEqual(typeof gemini.askGemini, 'function');
    assert.ok(gemini.ai && gemini.ai.models);
  });
  run('bot.js xatosiz require bo‘ladi (polling boshlanmaydi)', () => {
    const bot = require('../src/bot');
    assert.strictEqual(typeof bot.startBot, 'function');
  });

  // --- 2. splitMessage ---
  console.log('\nsplitMessage:');
  run('qisqa matn bitta bo‘lak', () => {
    const parts = h.splitMessage('salom');
    assert.strictEqual(parts.length, 1);
    assert.strictEqual(parts[0], 'salom');
  });
  run('uzun matn ko‘p bo‘lakka bo‘linadi, har biri <= 4096', () => {
    const big = 'a '.repeat(5000); // ~10000 belgi
    const parts = h.splitMessage(big);
    assert.ok(parts.length > 1, 'bir nechta bo‘lak kutilgan');
    for (const p of parts) assert.ok(p.length <= 4096, 'bo‘lak juda uzun: ' + p.length);
  });
  run('qatorlar bo‘yicha bo‘linadi', () => {
    const text = Array.from({ length: 2000 }, (_, i) => 'qator ' + i).join('\n');
    const parts = h.splitMessage(text, 1000);
    for (const p of parts) assert.ok(p.length <= 1000);
  });

  // --- 3. state: tarix + trim + reset ---
  console.log('\nstate (tarix):');
  run('xabar qo‘shiladi va HISTORY_LIMIT bo‘yicha trim bo‘ladi', () => {
    const id = 1001;
    for (let i = 0; i < 10; i++) {
      state.addUserMessage(id, 'u' + i);
      state.addModelMessage(id, 'm' + i);
    }
    const hist = state.getHistory(id);
    assert.ok(hist.length <= 4, 'tarix limitdan oshmasligi kerak, hozir: ' + hist.length);
  });
  run('reset tarixni tozalaydi', () => {
    const id = 1002;
    state.addUserMessage(id, 'salom');
    assert.ok(state.getHistory(id).length > 0);
    state.resetHistory(id);
    assert.strictEqual(state.getHistory(id).length, 0);
  });
  run('stats foydalanuvchi va xabarni sanaydi', () => {
    const before = state.getStats().totalMessages;
    state.track(2001);
    state.track(2002);
    const after = state.getStats();
    assert.strictEqual(after.totalMessages, before + 2);
    assert.ok(after.totalUsers >= 2);
  });

  // --- 4. rate limit ---
  console.log('\nrate limit:');
  run('RATE_LIMIT_MAX gacha ruxsat, keyin bloklanadi', () => {
    const id = 3001;
    const r1 = rateLimiter.check(id);
    const r2 = rateLimiter.check(id);
    const r3 = rateLimiter.check(id);
    assert.strictEqual(r1.allowed, true);
    assert.strictEqual(r2.allowed, true);
    assert.strictEqual(r3.allowed, false);
    assert.ok(r3.retryAfterSec >= 1);
  });

  // --- 5. handlerlar ---
  console.log('\nhandlerlar:');
  await runAsync('handleStart xush kelibsiz xabarini yuboradi', async () => {
    const send = makeSend();
    await h.handleStart({ chatId: 4001, send });
    assert.strictEqual(send.calls.messages.length, 1);
    assert.ok(send.calls.messages[0].text.length > 0);
  });
  await runAsync('handleReset tarixni tozalab, tasdiq yuboradi', async () => {
    const send = makeSend();
    state.addUserMessage(4002, 'x');
    await h.handleReset({ chatId: 4002, send, state });
    assert.strictEqual(state.getHistory(4002).length, 0);
    assert.strictEqual(send.calls.messages.length, 1);
  });
  await runAsync('handleStats: admin ko‘radi, oddiy foydalanuvchi yo‘q', async () => {
    const a = makeSend();
    await h.handleStats({ chatId: 5001, fromId: 999, send: a, state, config });
    assert.ok(/Statistika/.test(a.calls.messages[0].text));
    const b = makeSend();
    await h.handleStats({ chatId: 5002, fromId: 111, send: b, state, config });
    assert.ok(/admin/.test(b.calls.messages[0].text));
  });

  // --- 6. handleQuestion oqimi (mock ask) ---
  console.log('\nhandleQuestion (mock Gemini):');
  await runAsync('muvaffaqiyatli javob: typing + javob yuboriladi, tarixga model qo‘shiladi', async () => {
    const send = makeSend();
    let seen = null;
    const ask = async (history) => { seen = history[history.length - 1].text; return 'Bu javob.'; };
    const deps = { send, ask, state, rateLimiter, config };
    await h.handleQuestion({ chatId: 6001, text: 'Savol?', deps });
    assert.ok(send.calls.actions.some((a) => a.action === 'typing'), 'typing yuborilishi kerak');
    assert.ok(send.calls.messages.some((m) => m.text === 'Bu javob.'), 'javob yuborilishi kerak');
    assert.strictEqual(seen, 'Savol?');
    const hist = state.getHistory(6001);
    assert.strictEqual(hist[hist.length - 1].role, 'model');
  });
  await runAsync('uzun javob ko‘p xabarga bo‘linib yuboriladi', async () => {
    const send = makeSend();
    const ask = async () => 'x'.repeat(9000);
    const deps = { send, ask, state, rateLimiter, config };
    await h.handleQuestion({ chatId: 6002, text: 'Uzun?', deps });
    const msgs = send.calls.messages.filter((m) => m.text.startsWith('x'));
    assert.ok(msgs.length >= 2, 'kamida 2 bo‘lak kutilgan, bor: ' + msgs.length);
  });
  await runAsync('xatoda foydalanuvchiga xabar, oxirgi user xabari tarixdan olib tashlanadi', async () => {
    const send = makeSend();
    const ask = async () => { throw new Error('boom'); };
    const deps = { send, ask, state, rateLimiter, config };
    state.resetHistory(6003);
    await h.handleQuestion({ chatId: 6003, text: 'Xato?', deps });
    assert.ok(send.calls.messages.some((m) => /muammo|urinib/i.test(m.text)));
    assert.strictEqual(state.getHistory(6003).length, 0, 'muvaffaqiyatsiz user xabari pop bo‘lishi kerak');
  });
  await runAsync('rate limitdan oshganda "sekinroq" xabari, ask chaqirilmaydi', async () => {
    const send = makeSend();
    let askCalls = 0;
    const ask = async () => { askCalls += 1; return 'ok'; };
    const deps = { send, ask, state, rateLimiter, config };
    const id = 6004;
    await h.handleQuestion({ chatId: id, text: 'q1', deps });
    await h.handleQuestion({ chatId: id, text: 'q2', deps });
    await h.handleQuestion({ chatId: id, text: 'q3', deps }); // bu bloklanishi kerak
    assert.strictEqual(askCalls, 2, 'ask faqat 2 marta chaqirilishi kerak');
    assert.ok(send.calls.messages.some((m) => /sekinroq|soniya/i.test(m.text)));
  });

  console.log('\n———');
  if (process.exitCode === 1) {
    console.log('BA\u2019ZI TESTLAR YIQILDI');
  } else {
    console.log(passed + ' ta test muvaffaqiyatli o\u2018tdi ✅');
  }
})();
