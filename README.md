# 🎬 Social Media Video Downloader Bot

Telegram bot — Instagram, TikTok, YouTube, Facebook, Twitter/X, Pinterest va Likee
havolalaridan video/rasm yuklab, Telegram orqali qaytaradi. YouTube va har qanday
video uchun MP3 (audio) varianti, matn/ovoz orqali musiqa qidirish va aniqlash ham bor.

CommonJS (`require`), hech qanday database yo'q — JSON fayl persistensiya.

## ✨ Imkoniyatlar

- 7 platforma: Instagram, TikTok, YouTube, Facebook, Twitter/X, Pinterest, Likee
- YouTube uchun format tanlash: 🎬 360p / 720p / 🎵 MP3
- Har bir yuborilgan video ostida **🎵 Audio (MP3)** tugmasi
- **Rasm yuklash** (Pinterest va boshqalar) — `gallery-dl` orqali, bittalik yoki albom
- **Musiqa qidirish** — matn yozing, SoundCloud/YouTube'dan top 5 natija, tanlab MP3
- **Musiqa aniqlash** (Shazam kabi) — ovozli xabar yuboring, ACRCloud orqali aniqlanadi
- **Guruh rejimi** — guruhlarda faqat havolalar uchun ishlaydi; **obuna guruhda ham**
  tekshiriladi (per-user «✅ Tekshirish» tugmasi — faqat o'sha user bosa oladi)
- Barcha yuborishlar **reply** ko'rinishida (qaysi havolaga javob kelgani ko'rinadi)
- YouTube bot-check yechimi: `YTDLP_COOKIES_B64` (base64 cookies.txt)
- 50MB limit nazorati (Telegram Bot API cheklovi)
- Majburiy obuna (kanallarga `getChatMember` orqali tekshirish)
- **Broadcast aniqligi**: faqat `private` userlarga; bloklaganlar avtomatik
  belgilanadi va keyingi broadcastlarda o'tkazib yuboriladi; hisobot
  «Jami private / Yuborildi / Bloklagan»
- **Xavfsizlik**: har callback'da ADMIN_IDS tekshiruvi + callback_data formati
  validatsiyasi; rate limiting (daqiqasiga 5 yuklash); anti-flood (bir xil URL 30s);
  `execFile` (shell injection yo'q), whitelist URL regexlar, atomik JSON yozish
- **Kengaytirilgan user ma'lumotlari**: til, premium, username tarixi, manba,
  platforma bo'yicha yuklashlar — admin «👤 User qidirish» orqali to'liq karta
- **Admin xabardorligi**: yangi user, guruhga qo'shilish/chiqarilish, har 100-yuklash,
  kritik xatolar, **ruxsatsiz `/admin` urinishi**
- Admin panel: statistika, broadcast, kanallar, guruhlar, foydalanuvchilar,
  user qidirish, limitga urilganlar (24s), admin loglar (`admin_log.json`)

## 📦 Talablar

- Node.js 18+
- `yt-dlp` standalone binary (`postinstall` yuklab oladi → `bin/yt-dlp`)
- `gallery-dl` standalone binary (`postinstall` yuklab oladi → `bin/gallery-dl`)
- `ffmpeg` (MP3 konvertatsiya + musiqa aniqlashda audio kesish uchun)

## ⚙️ Sozlash

`.env.example` dan nusxa oling:

```bash
cp .env.example .env
```

`.env` ni to'ldiring:

| O'zgaruvchi     | Tavsif                                              |
| --------------- | --------------------------------------------------- |
| `BOT_TOKEN`         | @BotFather dan olingan token (**majburiy**)             |
| `ADMIN_IDS`         | Admin ID lari, vergul bilan: `123,456` (**majburiy**)   |
| `DATA_DIR`          | JSON papka (lokal `./data`, Railway `/app/data`)        |
| `DOWNLOADS_DIR`     | Vaqtinchalik fayllar papkasi (default `./downloads`)    |
| `YTDLP_COOKIES_B64` | Opsional: `cookies.txt` base64 ko'rinishi (YouTube fix) |
| `YTDLP_COOKIES`     | Opsional: cookies.txt yo'li (default `DATA_DIR/cookies.txt`) |
| `YTDLP_PATH`        | Opsional: yt-dlp binary (default `./bin/yt-dlp`)        |
| `GALLERY_DL_PATH`   | Opsional: gallery-dl binary (default `./bin/gallery-dl`) |
| `FFMPEG_PATH`       | Opsional: ffmpeg binary (default `ffmpeg`)              |
| `ACR_HOST`          | Opsional: ACRCloud host (musiqa aniqlash)               |
| `ACR_ACCESS_KEY`    | Opsional: ACRCloud access key                           |
| `ACR_ACCESS_SECRET` | Opsional: ACRCloud access secret                        |

> **ACRCloud** (`ACR_*`) uchalasi ham bo'sh bo'lsa, ovozdan musiqa aniqlash
> funksiyasi o'chiq bo'ladi (bot "sozlanmagan" deb javob beradi).

## 🚀 1. Lokal ishga tushirish (bitta qatorda)

```bash
npm install && cp -n .env.example .env && node src/bot.js
```

> `.env` dagi `BOT_TOKEN` va `ADMIN_IDS` ni to'ldirib bo'lgach ishga tushiring.

## ☁️ 2. Railway deploy qadamlari

1. Loyihani GitHub ga push qiling.
2. Railway'da **New Project → Deploy from GitHub repo** ni tanlang.
3. **Volume qo'shing**: Service → *Volumes* → *New Volume*, mount path: `/app/data`.
4. **Environment o'zgaruvchilarini** kiriting (Variables bo'limi — pastdagi ro'yxatga qarang).
5. `nixpacks.toml` `nodejs`, `ffmpeg`, `curl` ni o'rnatadi (python kerak emas).
   `npm install` esa `postinstall` orqali **yt-dlp** (`yt-dlp_linux`) va
   **gallery-dl** (`gallery-dl.bin`) standalone binary'larini `bin/` ga yuklaydi.
   Bot ishga tushganda diagnostika + `--version` loglari chiqadi.
6. Deploy tugagach bot polling rejimida ishga tushadi.

### Railway env o'zgaruvchilari ro'yxati

| O'zgaruvchi | Qiymat | Majburiy |
| --- | --- | --- |
| `BOT_TOKEN` | bot tokeningiz | ✅ |
| `ADMIN_IDS` | `123456789` (Telegram ID) | ✅ |
| `DATA_DIR` | `/app/data` | ✅ (Volume bilan) |
| `YTDLP_COOKIES_B64` | cookies.txt base64 (pastga qarang) | ⛔️ opsional |
| `ACR_HOST` / `ACR_ACCESS_KEY` / `ACR_ACCESS_SECRET` | ACRCloud (musiqa aniqlash) | ⛔️ opsional |

> BotFather sozlamasi: **/setprivacy → Disable** qiling — aks holda bot guruh
> xabarlarini (havolalarni) ko'rmaydi.

### cookies.txt ni base64 ga o'girish (Termux, bitta qator)

```bash
base64 -w0 cookies.txt
```

Chiqqan uzun qatorni `YTDLP_COOKIES_B64` ga qo'ying. (macOS'da: `base64 -i cookies.txt`.)

## 🧪 3. yt-dlp lokalda ishlashini tekshirish

```bash
./bin/yt-dlp --version && ffmpeg -version | head -1 && ./bin/yt-dlp -f "best[height<=360]" -o "test.%(ext)s" "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

Fayl yuklansa — sozlamalar to'g'ri. Tekshiruvdan keyin `test.*` faylni o'chiring.

## 🗂 Struktura

```
src/
├── bot.js                 # entry point, routing, cookies, notify, my_chat_member
├── config.js              # .env, konstantalar
├── handlers/
│   ├── start.js           # /start (+guruhga qo'shish), /help, /stats
│   ├── download.js        # URL/qidiruv/ovoz → video/rasm/MP3 oqimlari
│   ├── admin.js           # admin panel (state machine)
│   └── subscription.js    # majburiy obuna tekshiruvi
├── services/
│   ├── downloader.js      # yt-dlp + gallery-dl wrapper, MP3, qidiruv, 50MB
│   ├── storage.js         # atomik JSON (users/channels/groups/stats)
│   ├── urlcache.js        # callback uchun qisqa ID → URL (24h TTL)
│   ├── acrcloud.js        # musiqa aniqlash (HMAC-SHA1 identify API)
│   ├── media.js           # ffmpeg — audio namuna kesish
│   ├── notify.js          # notifyAdmins
│   ├── ratelimit.js       # rate limiting + anti-flood (xotirada)
│   ├── adminlog.js        # admin harakatlari logi (admin_log.json)
│   └── broadcast.js       # ommaviy xabar (private-only, blocked belgisi)
└── utils/
    ├── platform.js        # URL → platforma (whitelist regex)
    └── keyboard.js        # inline keyboardlar
```

## 📌 Eslatmalar

- **WeChat** qo'llab-quvvatlanmaydi (yt-dlp uni qo'llab-quvvatlamaydi).
- YouTube ba'zan datacenter IP-laridan *"Sign in to confirm you're not a bot"*
  xatosi beradi — bot buni ushlab, foydalanuvchiga tushunarli xabar qaytaradi.
  Yechim: `YTDLP_COOKIES_B64` orqali `cookies.txt` (base64) bering. Cookies bor
  holatda ham xato chiqsa, bot adminlarga "cookies eskirgan" ogohlantirishini yuboradi.
- Majburiy obuna ishlashi uchun bot har bir kanalda **admin** bo'lishi shart.
- Guruhda bot faqat qo'llab-quvvatlanadigan havolalarga javob beradi; obuna
  tekshirilmaydi. Guruh xabarlarini ko'rish uchun BotFather'da privacy o'chirilsin.

## 🛣 2-bosqich (reja) — 50MB+ fayllar uchun Local Bot API Server

Hozircha Telegram Bot API 50MB limiti bor. Kelajakda uni 2GB gacha ko'tarish uchun:

1. Railway'da **alohida servis** sifatida `aiogram/telegram-bot-api` (yoki
   rasmiy `telegram-bot-api`) Docker image'ini deploy qilish.
2. [my.telegram.org](https://my.telegram.org) dan `API_ID` va `API_HASH` olish va
   ularni o'sha servisga env sifatida berish.
3. Botda `node-telegram-bot-api` ni `baseApiUrl` (masalan
   `http://<local-api-servis>:8081`) ga yo'naltirish.
4. Natijada fayl yuborish limiti **2GB** bo'ladi va 50MB tekshiruvi yumshatiladi.

> Bu bosqich hozir amalga oshirilmagan — faqat reja.
