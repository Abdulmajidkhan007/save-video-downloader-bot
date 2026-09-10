'use strict';

// Oddiy in-memory holat (qaysi foydalanuvchi nima kutmoqda).
// Restart bo'lsa tozalanadi — bu ataylab, chunki bu vaqtinchalik UI holati.
const states = new Map();

function set(userId, value) {
  states.set(Number(userId), value);
}

function get(userId) {
  return states.get(Number(userId));
}

function clear(userId) {
  states.delete(Number(userId));
}

module.exports = { set, get, clear };
