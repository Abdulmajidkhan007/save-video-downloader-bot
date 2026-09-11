# 🎭 Anonim Savollar — Telegram Bot

> Anonymous Q&A Telegram bot with referral links, mandatory channel subscription, admin panel, blocking, reporting, rate limiting, and channel-join notifications.

Referral tizimli, to'liq funksiyali anonim savol-javob Telegram boti. Node.js'da yozilgan, Railway'ga deploy qilish uchun mo'ljallangan.

---

## ✨ Imkoniyatlar

- 🔗 **Referral havola** — har foydalanuvchiga shaxsiy `t.me/bot?start=KOD` havola
- 💬 **Ikki tomonlama anonim suhbat** — reply orqali javob qaytarish, asl xabarga quote ko'rinishida
- 🖼 **Media qo'llab-quvvatlash** — rasm, video, stiker, ovozli xabar (`copyMessage` bilan anonim)
- 🚫 **Bloklash** — har anonim xabar ostida tugma, `/blocks` ro'yxati
- 🚩 **Shikoyat** — adminga avtomatik forward + Global Ban tugmasi
- ⏳ **Rate limit** — sozlanadigan (sukut: 5/daqiqa, 30/soat)
- 📺 **Majburiy kanal obunasi** — admin paneldan boshqariladi (bot kanalda admin bo'lishi shart)
- 🛠 **Yashirin admin panel** (`/anoner`) — statistika, foydalanuvchilar (paginated), broadcast, banlar, kanallar
- 👤 **Foydalanuvchi → admin bog'lanish** (`/admin`) — to'g'ridan-to'g'ri xabar va reply
- 💬 **Maxsus salomlashuv matni** (`/welcome`) — referral havola orqali kelganlar uchun
- 🔔 **Real-time bildirishnomalar** — kanal obuna/chiqish, bot bloklash/qayta ochish, bot admin qilinishi
- 🔒 **Slash-menyu scope'i** — `/admin` foydalanuvchilarga, `/anoner` faqat admin chatida ko'rinadi
- 🚨 **Anti-scam tizimi** — foydalanuvchi kartochkasi ochilganda ID avtomatik qora ro'yxatlardan tekshiriladi:
  - Tashqi ochiq bazalar: [CAS (Combot Anti-Spam)](https://cas.chat) va [LOLS](https://lols.bot) — bepul, API kalitsiz
  - Lokal `global_blacklist` (`data/blacklist.json`) — admin tomonidan boshqariladi
  - Topilsa **"🚨 SKAMMER / SPAMMER"** signali chiqadi; bitta tugma bilan **Ban + Blacklist**
  - API ishlamasa fail-open: bot to'xtamaydi, faqat lokal natija ko'rsatiladi

---

## 🛠 Texnologiyalar

- **Node.js** ≥ 18 (CommonJS)
- [`node-telegram-bot-api`](https://github.com/yagop/node-telegram-bot-api) 0.66 — long-polling
- [`dotenv`](https://github.com/motdotla/dotenv) — env yuklash
- JSON faylda saqlash (Volume bilan persistent)

---

## 📁 Loyiha tuzilmasi

```
anonim-bot/
├── index.js              ← Bootstrap (token, polling, setMyCommands)
├── src/
│   ├── state.js          ← Saqlash, ma'lumot strukturalari
│   ├── util.js           ← Klaviaturalar, formatlash, escMd
│   ├── checks.js         ← Rate limit, ban, block, kanal obunasi
│   ├── blacklist.js      ← Anti-scam: CAS/LOLS API + lokal global_blacklist
│   ├── admin.js          ← Admin panel, broadcast, notifications
│   └── handlers.js       ← /start, message, callback, chat_member
├── data/                 ← Runtime JSON (Volume ulang!)
├── assets/welcome.png    ← Welcome banneri
├── scripts/make_image.py ← Bannerni qayta yasash uchun
├── test/smoke.js         ← 77 ta offline test
├── .env.example          ← Env namunasi
├── .gitignore
└── package.json
```

---

## 🚀 Lokalda ishga tushirish

```bash
git clone <REPO_URL>
cd anonim-bot
npm install
cp .env.example .env
# .env ichida BOT_TOKEN va ADMIN_ID qo'ying
npm start
```

Testlar:
```bash
npm test
```

---

## 🌐 Railway'ga deploy qilish

### 1. GitHub'ga yuklang
```bash
git init
git add .
git commit -m "initial: anonim bot v2.2.1"
git branch -M main
git remote add origin <YOUR_GITHUB_URL>
git push -u origin main
```

### 2. Railway'da yangi loyiha
1. [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** → loyihani tanlang
2. Railway avtomatik aniqlaydi: `npm install` → `npm start`

### 3. Environment variables qo'shish
Variables bo'limida:

| Nom | Qiymat | Izoh |
|-----|--------|------|
| `BOT_TOKEN` | `123:AAE...` | @BotFather'dan |
| `ADMIN_ID` | `123456789` | @userinfobot'dan |
| `DATA_DIR` | `/app/data` | **Volume mount path** |
| `RATE_PER_MIN` | `5` | ixtiyoriy |
| `RATE_PER_HOUR` | `30` | ixtiyoriy |
| `REQUIRED_CHANNELS` | `@kanal1,@kanal2` | ixtiyoriy boshlang'ich kanallar |

### 4. ⚠️ Volume qo'shish (MUHIM!)
Settings → **Volumes** → **+ New Volume**:
- Mount path: `/app/data`
- Size: 1 GB

**Volume bo'lmasa, har deploy'da foydalanuvchilar, kodlar, sessiyalar o'chadi!**

### 5. Deploy
"Deploy" tugmasini bosing. Loglarda quyidagi ko'rinishi kerak:
```
✅ @your_bot_username ishga tushdi (DATA_DIR=/app/data)
```

---

## 💬 Komandalar

### Foydalanuvchilar uchun
| Komanda | Vazifa |
|---------|--------|
| `/start` | Botni boshlash, shaxsiy havola olish |
| `/start KOD` | Kimningdir havolasi orqali anonim xabar yuborish |
| `/welcome [matn]` | Maxsus salomlashuv matnini o'rnatish |
| `/blocks` | Bloklangan foydalanuvchilar ro'yxati |
| `/admin` | Admin bilan bog'lanish |

### Admin uchun (faqat `ADMIN_ID` ko'radi)
| Komanda | Vazifa |
|---------|--------|
| `/anoner` | Admin panelini ochish |

Admin panel bo'limlari: 📊 Statistika · 👥 Foydalanuvchilar (paginated, batafsil + referral havola + ban) · 📢 Broadcast · 🚫 Banlar · 📺 Kanallar

---

## 🔔 Avtomatik bildirishnomalar

Admin'ga avtomatik keladi:
- 🚩 Shikoyat (asl xabar nusxasi + Global Ban tugmasi)
- ✅ Yangi obunachi (kanal nomi, ism, username, ID) — bot kanalda admin bo'lsa
- ❌ Kanaldan chiqdi
- 🚫 Foydalanuvchi botni bloklagan / o'chirgan (ism, username, ID)
- 🔓 Foydalanuvchi botni qayta ochgan
- 🔔 Bot kanalda admin qilindi / olib tashlandi

---

## 🧪 Test

77 ta offline smoke-test (Telegram'siz, mock bilan):
```bash
npm test
```

Tekshiriladi: referral oqimi, reply quote, bloklash, rate limit, shikoyat, banlar, /admin contact, /anoner paneli, foydalanuvchi batafsil ko'rinishi + referral link, kanal obuna bildirishnomalari, bloklash bildirishnomasi.

---

## 📝 Litsenziya

MIT

---

**Muallif:** [@Abdulloh_77700](https://t.me/Abdulloh_77700)
