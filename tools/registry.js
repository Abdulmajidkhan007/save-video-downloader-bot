'use strict';

// bots.json ustidagi TOZA (I/O siz) mantiq. Shu sabab test qilish oson —
// tools/registry.test.js faqat shu modulni sinaydi.

const VALID_RUNTIMES = ['node', 'python'];

/**
 * bots.json tarkibini tekshiradi. Xato bo'lsa — throw (jim yutilmaydi).
 * @param {unknown} raw JSON.parse natijasi
 * @returns {Array<object>} tekshirilgan botlar ro'yxati
 */
function validateRegistry(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.bots)) {
    throw new Error('bots.json noto\'g\'ri: yuqori darajada "bots" massivi kutilgan');
  }
  const seen = new Set();
  for (const bot of raw.bots) {
    if (!bot || typeof bot.id !== 'string' || !bot.id) {
      throw new Error('bots.json: har bir botda bo\'sh bo\'lmagan "id" bo\'lishi shart');
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(bot.id)) {
      throw new Error(`bots.json: "${bot.id}" — id faqat kichik harf, raqam va "-" dan iborat bo'lsin`);
    }
    if (seen.has(bot.id)) throw new Error(`bots.json: "${bot.id}" id takrorlangan`);
    seen.add(bot.id);
    if (!VALID_RUNTIMES.includes(bot.runtime)) {
      throw new Error(`bots.json: "${bot.id}" — runtime "${bot.runtime}" noma'lum (${VALID_RUNTIMES.join('/')})`);
    }
    assertSteps(bot.id, 'install', bot.install);
    assertSteps(bot.id, 'start', bot.start);
    if (bot.start.length === 0) {
      throw new Error(`bots.json: "${bot.id}" — "start" bo'sh bo'lmasligi kerak`);
    }
  }
  return raw.bots;
}

function assertSteps(id, field, steps) {
  if (!Array.isArray(steps)) {
    throw new Error(`bots.json: "${id}" — "${field}" massiv bo'lishi kerak`);
  }
  for (const step of steps) {
    if (!Array.isArray(step) || step.length === 0 || step.some((a) => typeof a !== 'string')) {
      throw new Error(`bots.json: "${id}" — "${field}" ichidagi har qadam bo'sh bo'lmagan satrlar massivi bo'lsin`);
    }
  }
}

/**
 * Foydalanuvchi bergan nishonni (target) botlar ro'yxatiga aylantiradi.
 * "all" → autoStart:true bo'lganlar (--all bilan hammasi).
 * @param {string} target bot id yoki "all"
 * @param {Array<object>} bots
 * @param {{includeManual?: boolean}} [opts]
 */
function resolveTargets(target, bots, opts = {}) {
  if (target === 'all') {
    const chosen = opts.includeManual ? bots : bots.filter((b) => b.autoStart !== false);
    if (chosen.length === 0) {
      throw new Error('Avtomatik ishga tushadigan bot yo\'q (--all bilan urinib ko\'ring)');
    }
    return chosen;
  }
  const bot = bots.find((b) => b.id === target);
  if (!bot) {
    throw new Error(`"${target}" nomli bot yo'q. Mavjudlari: ${bots.map((b) => b.id).join(', ')}`);
  }
  return [bot];
}

/** Log satrlarini tekislash uchun eng uzun id uzunligi. */
function padWidth(bots) {
  return bots.reduce((max, b) => Math.max(max, b.id.length), 0);
}

module.exports = { validateRegistry, resolveTargets, padWidth, VALID_RUNTIMES };
