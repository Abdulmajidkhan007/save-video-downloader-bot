// ============================================================
//  Quiz dvigateli (engine)
//  Telegram'ning native "quiz poll" funksiyasidan foydalanadi:
//   - open_period  -> har savol uchun taymer (soniyalarda)
//   - correct_option_id -> to'g'ri javob
//   - is_anonymous:false -> kim javob berganini bilish (poll_answer)
// ============================================================
const storage = require('./storage');
const questions = require('./questions');

const sessions = {};    // userId -> session
const pollToUser = {};  // poll_id -> userId

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Variantlarni aralashtirib, to'g'ri javob indeksini qayta hisoblaymiz
function prepareQuestion(q) {
  const opts = (q.options || []).map((opt, i) => ({ opt, correct: i === q.correct }));
  const sh = shuffle(opts);
  return {
    text: q.q || q.question || '',
    options: sh.map(x => x.opt),
    correct: sh.findIndex(x => x.correct),
    explanation: q.explanation || null
  };
}

function hasActiveSession(userId) { return !!sessions[userId]; }

function startQuiz(bot, chatId, userId, directionKey, subKey, count, seconds) {
  const bank = questions.getQuestions(directionKey, subKey);
  if (!bank.length) {
    bot.sendMessage(chatId, "⚠️ Bu bo'limda hozircha savol yo'q.");
    return;
  }
  const n = Math.min(count, bank.length);
  const list = shuffle(bank).slice(0, n).map(prepareQuestion);

  sessions[userId] = {
    chatId, userId, directionKey, subKey,
    label: questions.getSubLabel(directionKey, subKey),
    list, index: 0, score: 0, wrong: [],
    seconds, answered: false, timer: null, currentPollId: null
  };

  bot.sendMessage(chatId,
    `🚀 Test boshlandi!\n\n` +
    `📚 Bo'lim: ${sessions[userId].label}\n` +
    `❓ Savollar: ${n} ta\n` +
    `⏱ Har savolga: ${seconds} soniya`
  );
  setTimeout(() => sendNext(bot, userId), 1500);
}

function sendNext(bot, userId) {
  const s = sessions[userId];
  if (!s) return;
  const q = s.list[s.index];
  s.answered = false;

  bot.sendPoll(
    s.chatId,
    `❓ ${s.index + 1}/${s.list.length}  •  ${q.text}`,
    q.options,
    {
      type: 'quiz',
      correct_option_id: q.correct, // agar API xato bersa: correct_option_ids: [q.correct]
      open_period: s.seconds,
      is_anonymous: false,
      explanation: q.explanation || undefined
    }
  ).then((msg) => {
    if (msg && msg.poll) {
      s.currentPollId = msg.poll.id;
      pollToUser[msg.poll.id] = userId;
    }
    // Vaqt tugaganda javob bermasa ham keyingisiga o'tamiz
    s.timer = setTimeout(() => advance(bot, userId, false), (s.seconds + 2) * 1000);
  }).catch((e) => {
    bot.sendMessage(s.chatId, '⚠️ Savol yuborishda xato: ' + e.message);
    delete sessions[userId];
  });
}

// poll_answer kelganda chaqiriladi
function handleAnswer(bot, pollAnswer) {
  const userId = pollToUser[pollAnswer.poll_id];
  if (!userId) return;
  const s = sessions[userId];
  if (!s || s.answered) return;

  const q = s.list[s.index];
  const chosen = (pollAnswer.option_ids || [])[0];
  if (chosen === q.correct) s.score++;
  else s.wrong.push({ text: q.text, correct: q.options[q.correct] });

  advance(bot, userId, true);
}

function advance(bot, userId, answered) {
  const s = sessions[userId];
  if (!s || s.answered) return;
  s.answered = true;
  if (s.timer) { clearTimeout(s.timer); s.timer = null; }
  if (s.currentPollId) { delete pollToUser[s.currentPollId]; s.currentPollId = null; }

  // Javob bermay vaqt tugagan bo'lsa — xato deb hisoblaymiz
  if (!answered) {
    const q = s.list[s.index];
    s.wrong.push({ text: q.text, correct: q.options[q.correct] });
  }

  s.index++;
  if (s.index < s.list.length) {
    setTimeout(() => sendNext(bot, userId), 1200);
  } else {
    finish(bot, userId);
  }
}

function finish(bot, userId) {
  const s = sessions[userId];
  if (!s) return;
  const total = s.list.length;
  const score = s.score;
  const pct = Math.round((score / total) * 100);

  storage.addResult({
    userId, label: s.label,
    directionKey: s.directionKey, subKey: s.subKey,
    score, total, pct, date: new Date().toISOString()
  });

  const user = storage.getUser(userId) || { id: userId };
  user.testsCount = (user.testsCount || 0) + 1;
  user.bestPct = Math.max(user.bestPct || 0, pct);
  storage.upsertUser(user);

  let emoji = '📕';
  if (pct === 100) emoji = '🏆';
  else if (pct >= 70) emoji = '🥇';
  else if (pct >= 50) emoji = '🥈';

  let text = `${emoji} Test yakunlandi!\n\n` +
    `📚 ${s.label}\n` +
    `✅ To'g'ri: ${score}/${total}\n` +
    `📊 Natija: ${pct}%\n`;

  if (s.wrong.length) {
    text += `\n❌ Xato/javobsiz savollar:\n`;
    s.wrong.slice(0, 10).forEach((w, i) => {
      text += `${i + 1}. ${w.text}\n   ✔️ ${w.correct}\n`;
    });
  }
  text += `\nYana test ishlash uchun "📝 Test ishlash" tugmasini bosing.`;

  bot.sendMessage(s.chatId, text);
  delete sessions[userId];
}

module.exports = { startQuiz, handleAnswer, hasActiveSession };
