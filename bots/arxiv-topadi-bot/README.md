# recover-guide-bot

Telegram **qo‘llanma-bot**. Foydalanuvchi `/start` bosganda, guruhda adashib
**o‘chib ketgan xabarlarni** o‘z telefonida (**Termux + Ubuntu + Python +
Telethon**) tiklashni **bosqichma-bosqich** o‘rgatadi. Navigatsiya inline
tugmalar bilan. 6-qadamda bot foydalanuvchiga tayyor `recover.py` faylini
yuboradi.

> Bot **state saqlamaydi**, JSON persistence yoki Volume kerak emas.

---

## Nima qiladi

- `/start` → xush kelibsiz xabari + **Boshlash** tugmasi.
- 8 ta qadam, tugmalar bilan oldinga/orqaga yuriladi (`⬅️ Orqaga`, `Oldinga ➡️`, `🏠 Boshiga`).
- **6-qadam**da `recover.py` fayl sifatida yuboriladi.
- `recover.py` — Telethon `iter_admin_log(source, delete=True)` orqali o‘chirilgan
  xabarlarni o‘qib, yangi guruhga ko‘chiradi.

## Papka tuzilishi

```
recover-guide-bot/
├── src/
│   ├── index.js       # bot ishga tushirish, /start, callback router
│   ├── steps.js       # STEPS massivi (qadam matnlari, HTML)
│   ├── keyboard.js    # inline tugmalar yasovchi funksiyalar
│   └── script.js      # buildScript(): recover.py matnini qaytaradi
├── .env.example       # BOT_TOKEN=
├── .gitignore
├── package.json       # node-telegram-bot-api@0.66.0 (CommonJS)
└── README.md
```

## O‘rnatish

```bash
npm install
```

`node-telegram-bot-api` versiyasi **0.66.0** ga pin qilingan (yangi versiyalar
CommonJS `require` ni buzadi).

## Ishga tushirish

Bot tokeni **faqat** `BOT_TOKEN` muhit o‘zgaruvchisidan olinadi — hech qachon
kodga yozilmaydi yoki commit qilinmaydi.

```bash
BOT_TOKEN=123456:ABC... node src/index.js
```

yoki `.env.example` dan nusxa olib:

```bash
cp .env.example .env
# .env ichida BOT_TOKEN=... to'ldiring, keyin:
BOT_TOKEN=$(grep -E '^BOT_TOKEN=' .env | cut -d= -f2-) node src/index.js
```

Tokenni [@BotFather](https://t.me/BotFather) dan olasiz.

---

## Railway'ga deploy

Bot **polling** rejimida ishlaydi (HTTP port ochmaydi), shuning uchun Railway'da
**worker** process sifatida ishlaydi — `Procfile` (`worker: npm start`) shuni
ta'minlaydi. Volume yoki port sozlash **kerak emas**.

1. Railway'da **New Project → Deploy from GitHub repo** → shu reponi tanlang.
2. **Variables** bo'limiga qo'shing:
   ```
   BOT_TOKEN = <BotFather'dan olingan token>
   ```
3. Railway o'zi `npm install` qilib, `npm start` (ya'ni `node src/index.js`) ishga tushiradi.
4. **Deploy Logs**'da `Bot ishga tushdi (polling)` chiqsa — tayyor. Telegram'da botga `/start` yozing.

> `.env` faylini Railway'ga yuklamang — tokenni faqat **Variables** orqali bering.
> Bir vaqtda faqat **bitta** instans ishlashi kerak (polling), shuning uchun
> replicas = 1 qoldiring.

---

## 🔒 XAVFSIZLIK (o‘qib chiqing)

- Bu bot **hech kimdan** telefon, login kod yoki 2FA parol **so‘ramaydi**.
  Faqat yo‘l-yo‘riq beradi.
- `recover.py` foydalanuvchining **o‘z qurilmasida**, **o‘z akkountida** ishlaydi.
- Faqat foydalanuvchi **admin** bo‘lgan guruhda ishlaydi (o‘chirilgan xabarlar
  **admin log**dan olinadi, admin log esa faqat adminlarga ko‘rinadi va ~48 soat saqlanadi).
- **Login kodni yoki 2FA parolni hech qachon birovning botiga kiritmang** —
  kodni so‘ragan bot akkountingizni o‘g‘irlamoqchi bo‘ladi. Telethon `.start()`
  bu ma’lumotlarni faqat sizning terminalingizda so‘raydi.
- `api_hash` va `*.session` faylini hech kimga bermang. Ular `.gitignore` da.

## Litsenziya

MIT
