# Gemini Q&A Bot

Google **Gemini API** asosida ishlaydigan Telegram bot. Foydalanuvchining savollariga javob beradi, qisqa suhbat kontekstini eslab qoladi.

## Imkoniyatlar

- Gemini bilan savol-javob (yangi `@google/genai` SDK)
- Suhbat konteksti (oxirgi bir necha xabar eslab qolinadi)
- `/reset` — kontekstni tozalash
- Rate limit (spamdan himoya)
- Uzun javoblar avtomatik bo'laklarga bo'linadi (Telegram 4096 belgi cheklovi)
- "Yozyapti..." holati
- Ixtiyoriy admin `/stats`
- Sozlamalar `.env` orqali (model, temperatura, kontekst uzunligi va h.k.)

## 1. Kalitlarni olish

**Telegram token:** Telegram'da [@BotFather](https://t.me/BotFather) → `/newbot` → token nusxalanadi.

**Gemini API kalit:** [Google AI Studio](https://aistudio.google.com/apikey) → "Create API key".

## 2. Lokal ishga tushirish (Termux / Ubuntu)

```
cp .env.example .env
# .env faylga TELEGRAM_TOKEN va GEMINI_API_KEY ni yozing
npm install
npm start
```

Test:

```
npm test
```

## 3. Sozlamalar (.env)

| O'zgaruvchi | Standart | Izoh |
|---|---|---|
| `TELEGRAM_TOKEN` | — | majburiy |
| `GEMINI_API_KEY` | — | majburiy |
| `GEMINI_MODEL` | `gemini-2.5-flash` | model nomi |
| `SYSTEM_PROMPT` | (bor) | botning xulqi |
| `TEMPERATURE` | `0.7` | ijodkorlik darajasi |
| `MAX_OUTPUT_TOKENS` | `1024` | javob uzunligi |
| `HISTORY_LIMIT` | `10` | kontekst (xabarlar soni) |
| `RATE_LIMIT_MAX` | `5` | oynadagi maks so'rov |
| `RATE_LIMIT_WINDOW_MS` | `60000` | oyna (ms) |
| `ADMIN_ID` | — | `/stats` uchun admin ID |

> Model nomi o'zgarsa, faqat `GEMINI_MODEL` ni yangilaysiz — kodga tegmasdan.

## 4. GitHub repoga ulash

```
git init
git add .
git commit -m "Gemini Q&A bot"
gh repo create gemini-qa-bot --private --source=. --remote=origin --push
```

`.gitignore` `.env` va `node_modules/` ni repodan chiqarib tashlaydi — **API kalit hech qachon repoga tushmaydi**.

## 5. Railway'ga deploy

1. Railway → New Project → Deploy from GitHub repo → shu repo.
2. **Variables** bo'limiga `TELEGRAM_TOKEN`, `GEMINI_API_KEY` (va kerak bo'lsa boshqalarini) qo'shing.
3. Start command: `npm start` (yoki `node index.js`).

Bot polling rejimida ishlaydi, shuning uchun qo'shimcha URL sozlash shart emas.

## Struktura

```
index.js            — kirish nuqtasi
src/config.js       — .env yuklash va tekshirish
src/gemini.js       — Gemini klient + askGemini()
src/state.js        — suhbat tarixi + stats
src/rateLimit.js    — rate limit
src/handlers.js     — buyruq va savol oqimi (testlanadigan)
src/bot.js          — Telegram hodisalarini ulash
test/smoke.test.js  — smoke testlar
```
