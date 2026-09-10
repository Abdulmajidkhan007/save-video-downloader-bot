'use strict';

// Inline tugmalar yasovchi funksiyalar.
// Callback data formati: "step:<index>".

// Berilgan qadam uchun navigatsiya klaviaturasi.
function stepKeyboard(index, total) {
  const nav = [];

  if (index > 0) {
    nav.push({ text: '⬅️ Orqaga', callback_data: 'step:' + (index - 1) });
  }
  if (index < total - 1) {
    nav.push({ text: 'Oldinga ➡️', callback_data: 'step:' + (index + 1) });
  }

  const rows = [];
  if (nav.length) rows.push(nav);

  // Progress / boshiga qaytish qatori
  const bottom = [
    { text: `${index + 1}/${total}`, callback_data: 'noop' },
  ];
  if (index !== 0) {
    bottom.push({ text: '🏠 Boshiga', callback_data: 'step:0' });
  }
  rows.push(bottom);

  return { inline_keyboard: rows };
}

// /start dagi boshlang'ich tugma.
function startKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🚀 Boshlash', callback_data: 'step:0' }],
    ],
  };
}

module.exports = { stepKeyboard, startKeyboard };
