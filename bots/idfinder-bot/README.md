# 🆔 ID Topuvchi Bot

Telegram foydalanuvchi, kanal va guruhlarning **ID** larini topish uchun bot.
Node.js (CommonJS) + [`node-telegram-bot-api`](https://github.com/yagop/node-telegram-bot-api) `0.66.0` (polling rejimi).

## ✨ Imkoniyatlar

- 🔒 **Majburiy obuna** — sozlangan kanal(lar)ga a'zolikni `getChatMember` orqali tekshiradi.
- 🔍 **Foydalanuvchini qidirish**
  - 🔢 User ID orqali → `getChat(id)`
  - 📛 Username orqali → `getChat(@username)`
  - 📞 Telefon orqali → kontakt ulashish (`request_contact` → `contact.user_id`)
- 🆔 **Kanal / Group / User ID olish**
  - 📢 Kanal tanlash → `request_chat` (`chat_is_channel: true`)
  - 👥 Group tanlash → `request_chat` (`chat_is_channel: false`)
  - 👤 Foydalanuvchi tanlash → `request_users`
  - ↪️ Forward qilingan xabardan → `forward_from_chat` / `forward_from`
  - Kanal/guruh natijalari **boyitilgan**: tur, a'zolar soni (`getChatMemberCount`), adminlar soni + egasi (`getChatAdministrators`, bot a'zo bo'lsa), tavsif, havola.
  - Bot chatga a'zo bo'lmasa — **"➕ Botni qo'shish"** tugmasi (`?startgroup` / `?startchannel`).
- 👤 **Mening ID'im**
- ⚡ **Inline mode** — istalgan chatda `@bot_username @durov` yozib ID olish (public/ko'rilgan entity).
- 🛠 **Admin panel** — statistika (qidiruvlar, ID olish va **inline** alohida), majburiy kanallar boshqaruvi, broadcast, foydalanuvchilar ro'yxati.

> ⚡ Inline mode ishlashi uchun @BotFather'da `/setinline` ni yoqing (bir marta).

## ⚠️ Bot API cheklovi (telefon orqali qidiruv)

Ixtiyoriy telefon raqamini **matn** sifatida kiritib akkount topish Telegram Bot API'da
**mumkin emas**. Telefon orqali qidiruv **faqat** kontakt ulashish (`contact.user_id`) orqali
ishlaydi. Kontaktda `user_id` bo'lmasa (maxfiylik yoki raqam Telegram'da yo'q), bot
buni tushuntiruvchi xabar qaytaradi.

## 🚀 O'rnatish

```bash
npm install
cp .env.example .env   # va qiymatlarni to'ldiring
npm start
```

### `.env`

| O'zgaruvchi  | Tavsif                                                  |
| ------------ | ------------------------------------------------------- |
| `BOT_TOKEN`  | @BotFather'dan olingan token (majburiy)                 |
| `ADMIN_IDS`  | Admin ID lari, vergul bilan: `111,222`                  |
| `DATA_DIR`   | Runtime data papkasi. Railway: `/app/data`. Lokal: `./data` |

> ⚙️ BotFather'da botning **Group Privacy** ni o'chiring (guruhda forward/xabarlarni ko'rishi uchun)
> va kanallarni tekshirish uchun botni majburiy kanallarga **admin** qilib qo'shing.

## 📁 Struktura

```
src/
  bot.js              # entry: polling, callback/message routing
  config.js           # env: BOT_TOKEN, ADMIN_IDS, DATA_DIR
  utils/
    storage.js        # JSON o'qish/yozish, /app/data, seed copy
    subscription.js   # majburiy obuna tekshiruvi (getChatMember)
    keyboards.js      # inline + reply keyboardlar (request_chat/users)
    state.js          # in-memory foydalanuvchi holati
    format.js         # natijalarni matnga formatlash
  handlers/
    start.js          # /start, menyu, obuna gate
    search.js         # id / username / phone qidiruv
    getId.js          # chat_shared / users_shared / forward
    admin.js          # admin panel
seed/                 # bundled seed JSON (channels/users/stats)
data/                 # runtime JSON (gitignore; Railway Volume /app/data)
```

## 💾 Persistence

Barcha runtime JSON `DATA_DIR` (Railway'da `/app/data` Volume) ichida saqlanadi.
Birinchi ishga tushganda `seed/` dagi fayllar `DATA_DIR` ga ko'chiriladi (agar mavjud bo'lmasa):

- `users.json` — `{ id, username, first_name, joined_at }`
- `channels.json` — majburiy kanallar
- `stats.json` — qidiruvlar / ID olish statistikasi

## ☁️ Railway

1. Repo'ni Railway'ga ulang.
2. **Variables**: `BOT_TOKEN`, `ADMIN_IDS`, `DATA_DIR=/app/data`.
3. **Volume** yarating va `/app/data` ga mount qiling.
4. Deploy. Start buyrug'i: `npm start`.

## 🧪 Smoke test

`npm start` dan so'ng Telegram'da:

1. **Obuna** — kanalga a'zo bo'lmasdan turib gate ishlashini, "✅ Obunani tekshirish" ni tekshiring.
2. **Qidiruv** — ID, @username, kontakt ulashish (3 usul).
3. **ID olish** — kanal tanlash, group tanlash, user tanlash, forward (3+1 usul).
4. **Admin** — statistika, kanal qo'shish/o'chirish, broadcast, foydalanuvchilar.
