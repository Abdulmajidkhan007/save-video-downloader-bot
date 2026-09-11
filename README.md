# 🤖 Telegram Bots Monorepo

**11 ta mustaqil Telegram bot — bitta repoda.** Har bot `bots/<nom>/` papkasida to'liq
alohida loyiha: o'z kodi, o'z `package.json`/`requirements.txt`, o'z `.env.example`,
o'z `README.md`. Papkani nusxalab olsangiz — bot mustaqil ishlaydi.

> 🔒 **Bu repoda hech qanday kalit yoki token yo'q.** Faqat `.env.example` namunalari bor.
> Har commit'dan oldin `npm run scan` avtomatik tekshiradi.

---

## 📦 Botlar

| # | Papka | Til | Nima qiladi |
|---|-------|-----|-------------|
| 1 | [`save-video-downloader-bot`](bots/save-video-downloader-bot) | Node | YouTube / Instagram / TikTok va boshqalardan **video va MP3** yuklaydi (yt-dlp + ffmpeg), majburiy obuna, admin panel, referral |
| 2 | [`anonim-bot`](bots/anonim-bot) | Node | **Anonim savol-javob** — referral havola, ikki tomonlama suhbat, bloklash, shikoyat |
| 3 | [`arxiv-topadi-bot`](bots/arxiv-topadi-bot) | Node | O'chib ketgan xabarlarni **Termux + Telethon** orqali tiklashni o'rgatuvchi qo'llanma-bot |
| 4 | [`gemini-qa-bot`](bots/gemini-qa-bot) | Node | **Google Gemini** asosidagi savol-javob boti, suhbat konteksti bilan |
| 5 | [`idfinder-bot`](bots/idfinder-bot) | Node | Foydalanuvchi / kanal / guruh **ID** larini topadi |
| 6 | [`malware-bot`](bots/malware-bot) | Node | Havola va fayllarni **VirusTotal** orqali zararli dasturga tekshiradi |
| 7 | [`quiz-bot`](bots/quiz-bot) | Node | IT yo'nalishlari bo'yicha **test** boti: yakka va guruh testlari, reyting |
| 8 | [`killspam-bot`](bots/killspam-bot) | Python | Guruhlarni **spam** va zararli havolalardan tozalaydi (PostgreSQL kerak) |
| 9 | [`xulosa-ai-bot`](bots/xulosa-ai-bot) | Python | Guruh/kanal yozishmalarini **Gemini AI** bilan xulosalaydi (Telethon userbot) |
| 10 | [`countlist-ts-node`](bots/countlist-ts-node) | TypeScript | Guruh **xarajatlarini hisoblovchi** bot + NestJS API + React dashboard |
| 11 | [`atoyo-ai-bot`](bots/atoyo-ai-bot) | Python | Mahsulot rasmlarini **Gemini** bilan tahlil qilib katalog kartochkasi yasaydi (Telethon **userbot**) |

Batafsil ma'lumot — har bot papkasidagi `README.md` da.

---

## 🚀 Tez boshlash

### 1. Yuklab olish

```bash
git clone https://github.com/Abdulmajidkhan007/save-video-downloader-bot.git
cd save-video-downloader-bot
```

Bitta buyruq — **hamma 10 ta bot** yuklab olinadi.

### 2. Botlar ro'yxatini ko'rish

```bash
npm run list
```

### 3. Sozlash (`.env` fayllarini yaratish)

```bash
npm run setup
```

Bu har bot papkasida `.env.example` dan `.env` yaratadi (mavjudiga tegmaydi).
Keyin **kerakli botning** `.env` faylini ochib, o'z tokeningizni yozing:

```bash
nano bots/quiz-bot/.env
```

### 4. Bog'liqliklarni o'rnatish

```bash
npm run install:all          # hamma bot uchun
node tools/run.js install quiz-bot   # faqat bittasi uchun
```

### 5. Ishga tushirish

```bash
npm run bot quiz-bot     # ❶ FAQAT BITTA bot
npm start                # ❷ HAMMA botlar birdan (avtomatik ishlaydiganlari)
npm run start:all        # ❸ qo'shimcha xizmat talab qiladiganlari bilan birga
```

Yoki botning o'z papkasiga kirib, oddiy holda:

```bash
cd bots/quiz-bot
npm install
npm start
```

Har uch usul ham ishlaydi — bot papkalari hech narsaga bog'liq emas.

### 6. Tekshirish

```bash
npm run doctor    # node/python bormi, .env va bog'liqliklar joyidami
npm run check     # testlar + kalit tekshiruvi
```

---

## 🧭 Buyruqlar

| Buyruq | Nima qiladi |
|--------|-------------|
| `npm run list` | Botlar ro'yxati va tavsifi |
| `npm run doctor` | Muhit tekshiruvi (node, python, `.env`, `node_modules`) |
| `npm run setup` | Hamma botga `.env.example` → `.env` |
| `npm run install:all` | Hamma botning bog'liqliklarini o'rnatadi |
| `npm start` | Hamma botni birdan ishga tushiradi (log oldida bot nomi bilan) |
| `npm run start:all` | Qo'lda sozlash kerak bo'lganlarini ham qo'shib ishga tushiradi |
| `npm run bot <nom>` | Bitta botni ishga tushiradi |
| `npm test` | Testlar (`tools/`) |
| `npm run scan` | Repoda kalit/token qolmaganini tekshiradi |

`Ctrl+C` — `npm start` bilan ishga tushgan hamma botni toza to'xtatadi.

> **Eslatma:** `npm start` faqat `bots.json` da `autoStart: true` bo'lgan botlarni
> ishga tushiradi. `killspam-bot`, `xulosa-ai-bot` va `countlist-ts-node` qo'shimcha
> xizmat (PostgreSQL, Redis, userbot sessiyasi) talab qiladi. `atoyo-ai-bot` ham
> shunday — birinchi ishga tushirishda telefon raqami so'raladi. Ular ro'yxatda
> `[qo'lda]` deb belgilangan — alohida ishga tushiring.

---

## 🗂 Repo tuzilishi

```
.
├── bots/                       # ← har bot mustaqil loyiha
│   ├── save-video-downloader-bot/
│   │   ├── src/  package.json  .env.example  README.md
│   ├── anonim-bot/
│   ├── quiz-bot/
│   └── ...                     # jami 11 ta
├── tools/
│   ├── run.js                  # boshqaruvchi CLI (list/setup/install/start/doctor)
│   ├── registry.js             # bots.json ustidagi toza mantiq
│   ├── scan-secrets.js         # kalit tekshiruvi
│   └── registry.test.js        # testlar
├── docs/
│   └── ARXITEKTURA-TARIXI.md   # qarorlar tarixi — nima uchun shunday qilingan
├── bots.json                   # botlar ro'yxati (runner shuni o'qiydi)
├── CLAUDE.md                   # kod yozish qoidalari
└── README.md
```

### Botni alohida ajratib olish

Har papka mustaqil — kelajakda alohida repoga ko'chirish oson:

```bash
cp -r bots/quiz-bot ~/quiz-bot
cd ~/quiz-bot && git init && npm install
```

Hech qanday root faylga bog'liqlik yo'q.

### Yangi bot qo'shish

1. Kodni `bots/<yangi-bot>/` ga qo'ying (ichida `.env.example` bo'lsin, `.env` bo'lmasin).
2. `bots.json` ga yozuv qo'shing (`id`, `runtime`, `install`, `start`).
3. `npm run check` — testlar `bots.json` va papkalar mosligini tekshiradi.

---

## 🔐 Xavfsizlik

- Repoda **hech qanday `.env` fayl yo'q** — faqat `.env.example`.
- Root `.gitignore` `.env` ni butun repo bo'ylab bloklaydi (`!.env.example` bundan mustasno).
- `npm run scan` Telegram token, Gemini/Google kaliti, OpenAI kaliti, GitHub token,
  AWS kaliti va private key bloklarini qidiradi; `.env*` fayllarda to'ldirilgan
  sirlarni ham topadi. Topilsa exit kodi `1` — CI ham shunda yiqiladi.
- Har bot o'z kalitini **faqat o'z `.env`** faylidan oladi; botlar bir-birining
  kalitini ko'rmaydi.

**Kalitni hech qachon kodga yozmang.** `.env` ga yozing — u git ga tushmaydi.

---

## ⚙️ Talablar

- **Node.js ≥ 18** — Node botlari va boshqaruvchi CLI uchun
- **Python ≥ 3.11** — `killspam-bot`, `xulosa-ai-bot`, `atoyo-ai-bot` uchun
- **yt-dlp + ffmpeg** — faqat `save-video-downloader-bot` uchun
- **PostgreSQL / Redis** — faqat `killspam-bot` va `countlist-ts-node` uchun

Boshqaruvchi CLI (`tools/run.js`) **hech qanday tashqi kutubxonaga bog'liq emas** —
toza Node bilan ishlaydi, root'da `npm install` qilish shart emas.

---

## 🚢 Deploy (Railway va shunga o'xshash)

Bu monorepo bo'lgani uchun har bot **alohida servis** sifatida deploy qilinadi.
Railway'da servis yaratganda **Root Directory** ni o'zgartiring:

```
Settings → Root Directory → bots/quiz-bot
```

Shunda Railway faqat o'sha papkani quradi va uning `package.json` idagi
`start` skriptini ishlatadi. Kalitlarni Railway **Variables** bo'limiga yozing
(`.env` fayl deploy'ga ketmaydi).

---

## 📄 Litsenziya

Root va aksar botlar — MIT. **`bots/killspam-bot`** o'zining
[PolyForm Noncommercial 1.0.0](bots/killspam-bot/LICENSE) litsenziyasi ostida —
o'sha papka uchun shu litsenziya amal qiladi.
