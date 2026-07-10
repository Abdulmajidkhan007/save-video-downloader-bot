# 🎬 Social Media Video Downloader Bot

Telegram bot — Instagram, TikTok, YouTube, Facebook, Twitter/X, Pinterest va Likee
havolalaridan videoni yuklab, Telegram orqali qaytaradi. YouTube uchun MP3 (audio)
varianti ham bor.

CommonJS (`require`), hech qanday database yo'q — JSON fayl persistensiya.

## ✨ Imkoniyatlar

- 7 platforma: Instagram, TikTok, YouTube, Facebook, Twitter/X, Pinterest, Likee
- YouTube uchun format tanlash: 🎬 360p / 720p / 🎵 MP3
- 50MB limit nazorati (Telegram Bot API cheklovi)
- Majburiy obuna (kanallarga `getChatMember` orqali tekshirish)
- Admin panel: statistika, broadcast (copy/forward, rate-limit), kanal boshqaruvi, foydalanuvchilar
- Foydalanuvchi statistikasi (`/stats`), yordam (`/help`)
- Rate limiting: bitta foydalanuvchi bir vaqtda faqat 1 ta yuklash
- Xavfsizlik: `execFile` (shell injection yo'q), whitelist URL regexlar
- Atomik JSON yozish (`.tmp` → `rename`)

## 📦 Talablar

- Node.js 18+
- `yt-dlp` (PATH da yoki `YTDLP_PATH` env orqali)
- `ffmpeg` (MP3 konvertatsiya uchun)

## ⚙️ Sozlash

`.env.example` dan nusxa oling:

```bash
cp .env.example .env
```

`.env` ni to'ldiring:

| O'zgaruvchi     | Tavsif                                              |
| --------------- | --------------------------------------------------- |
| `BOT_TOKEN`     | @BotFather dan olingan token (majburiy)             |
| `ADMIN_IDS`     | Admin ID lari, vergul bilan: `123,456`              |
| `DATA_DIR`      | JSON papka (lokal `./data`, Railway `/app/data`)    |
| `DOWNLOADS_DIR` | Vaqtinchalik videolar papkasi (default `./downloads`)|
| `YTDLP_COOKIES` | Opsional: `cookies.txt` yo'li (YouTube bot-check)   |
| `YTDLP_PATH`    | Opsional: yt-dlp binary yo'li (default `./bin/yt-dlp`)|

## 🚀 1. Lokal ishga tushirish (bitta qatorda)

```bash
npm install && cp -n .env.example .env && node src/bot.js
```

> `.env` dagi `BOT_TOKEN` va `ADMIN_IDS` ni to'ldirib bo'lgach ishga tushiring.

## ☁️ 2. Railway deploy qadamlari

1. Loyihani GitHub ga push qiling.
2. Railway'da **New Project → Deploy from GitHub repo** ni tanlang.
3. **Volume qo'shing**: Service → *Volumes* → *New Volume*, mount path: `/app/data`.
4. **Environment o'zgaruvchilarini** kiriting (Variables bo'limi):
   - `BOT_TOKEN` = bot tokeningiz
   - `ADMIN_IDS` = `123456789` (o'z Telegram ID(lar)ingiz)
   - `DATA_DIR` = `/app/data`
   - (opsional) `YTDLP_COOKIES` = `/app/data/cookies.txt`
5. `nixpacks.toml` avtomatik ishlaydi — `nodejs`, `ffmpeg`, `curl` o'rnatadi va
   yt-dlp'ning **standalone binary**'sini `./bin/yt-dlp` ga yuklab oladi
   (python kerak emas). Bot ishga tushganda `yt-dlp --version` log qilinadi.
6. Deploy tugagach bot polling rejimida ishga tushadi.

> **Agar binary yuklab bo'lmasa** (curl xatosi): fallback sifatida
> `youtube-dl-exec` yoki `yt-dlp-wrap` npm paketini qo'shib, `YTDLP_PATH` ni
> o'sha paket beradigan binary yo'liga sozlang.

## 🧪 3. yt-dlp lokalda ishlashini tekshirish

```bash
yt-dlp --version && ffmpeg -version | head -1 && yt-dlp -f "best[height<=360]" -o "test.%(ext)s" "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

Fayl yuklansa — sozlamalar to'g'ri. Tekshiruvdan keyin `test.*` faylni o'chiring.

## 🗂 Struktura

```
src/
├── bot.js                 # entry point, handlerlarni ulaydi
├── config.js              # .env, konstantalar
├── handlers/
│   ├── start.js           # /start, /help, /stats
│   ├── download.js        # URL → platforma → yuklash oqimi
│   ├── admin.js           # admin panel (state machine)
│   └── subscription.js    # majburiy obuna tekshiruvi
├── services/
│   ├── downloader.js      # yt-dlp wrapper (execFile), MP3, 50MB limit
│   ├── storage.js         # atomik JSON o'qish/yozish
│   └── broadcast.js       # ommaviy xabar (rate-limit, retry_after)
└── utils/
    ├── platform.js        # URL → platforma (whitelist regex)
    └── keyboard.js        # inline keyboardlar
```

## 📌 Eslatmalar

- **WeChat** qo'llab-quvvatlanmaydi (yt-dlp uni qo'llab-quvvatlamaydi).
- YouTube ba'zan datacenter IP-laridan *"Sign in to confirm you're not a bot"*
  xatosi beradi — bot buni ushlab, foydalanuvchiga tushunarli xabar qaytaradi.
  Yechim: `YTDLP_COOKIES` orqali `cookies.txt` bering.
- Majburiy obuna ishlashi uchun bot har bir kanalda **admin** bo'lishi shart.
