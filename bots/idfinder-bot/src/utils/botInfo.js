'use strict';

// Bot haqidagi ma'lumot (getMe) — startup'da bir marta o'rnatiladi.
let info = { username: null, id: null };

function set(me) {
  info = { username: me.username || null, id: me.id || null };
}

function username() {
  return info.username;
}

function id() {
  return info.id;
}

module.exports = { set, username, id };
