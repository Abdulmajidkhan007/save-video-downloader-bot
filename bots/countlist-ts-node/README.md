# 💰 Telegram Expense Tracker

> Production-ready Telegram bot + Web dashboard for tracking group expenses

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-339933?logo=node.js)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)](https://www.prisma.io/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)

---

## 📋 Mundarija

- [Loyiha haqida](#-loyiha-haqida)
- [Imkoniyatlar](#-imkoniyatlar)
- [Arxitektura](#%EF%B8%8F-arxitektura)
- [Texnologiyalar](#-texnologiyalar)
- [Ishga tushurish](#-ishga-tushurish)
- [Bot sozlash](#-telegram-bot-sozlash)
- [Foydalanish](#-foydalanish)
- [API hujjatlari](#-api-endpoints)
- [Loyiha tuzilmasi](#-loyiha-tuzilmasi)
- [Deployment](#-deployment)

---

## 🎯 Loyiha haqida

**Telegram Expense Tracker** — guruh xarajatlarini kuzatib boruvchi to'liq tizim:

- 🤖 **Telegram Bot** — guruhda xarajatlarni natural matn orqali kiritish
- 🚀 **REST API** — barcha biznes logika
- 💻 **Web Dashboard** — analitika, hisobotlar, boshqaruv

**Misol:**

```
Foydalanuvchi: 500000 so'm ovqatga
Bot: ✅ Xarajat qo'shildi
     👤 Ali
     💵 500,000 so'm
     📝 ovqatga
     🏷 🍕 Oziq-ovqat
```

---

## ✨ Imkoniyatlar

### 🤖 Telegram Bot

- ✅ Natural matn parsing: `500000 so'm`, `2 mln`, `50k`
- ✅ Avtomatik kategoriya aniqlash
- ✅ `/start /help /today /week /month /stats /top /categories /limit /export /settings`
- ✅ Inline keyboard menyular
- ✅ Multi-currency: UZS, USD, EUR, RUB
- ✅ Multi-group support
- ✅ Role-based access (admin/member)

### 📊 Analytics

- ✅ Kunlik / haftalik / oylik grafiklar
- ✅ Kategoriya pie chart
- ✅ Top sarflovchilar reytingi
- ✅ Oylik limit kuzatuvi
- ✅ Trend tahlili (prognoz)

### 📤 Export

- ✅ **PDF** — chop etishga tayyor format
- ✅ **CSV** — universal format
- ✅ **Excel (.xlsx)** — pivot tahlil uchun

### 🎨 Dashboard

- ✅ Premium fintech UI design
- ✅ Dark / Light mode
- ✅ Responsive (desktop + mobile)
- ✅ Framer Motion animatsiyalar
- ✅ Real-time data updates

### 🔐 Xavfsizlik

- ✅ JWT + Refresh Token
- ✅ Role-based guards
- ✅ Rate limiting (Throttler)
- ✅ Input validation (class-validator + Zod)
- ✅ SQL injection himoyasi (Prisma)

---

## 🏗️ Arxitektura

```
┌──────────────────────────────────────────────────────────────┐
│                      USER INTERFACES                          │
├─────────────────────────┬────────────────────────────────────┤
│    📱 Telegram Bot      │      💻 Web Dashboard               │
│   (Telegraf + TS)       │   (React + Vite + TailwindCSS)     │
└──────────┬──────────────┴───────────────┬────────────────────┘
           │                              │
           │         HTTP/WebSocket        │
           └──────────┬───────────────────┘
                      │
           ┌──────────▼──────────┐
           │   🚀 NestJS API     │
           │   (Fastify + JWT)   │
           └──────────┬──────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼────┐   ┌────▼────┐   ┌───▼────┐
   │ Postgres│   │  Redis  │   │  S3    │
   │ (Prisma)│   │ (Cache) │   │(files) │
   └─────────┘   └─────────┘   └────────┘
```

---

## 🛠️ Texnologiyalar

### Backend

| Texnologiya | Maqsadi |
|-------------|---------|
| **Node.js 20+** | Runtime |
| **TypeScript 5** | Strict typing |
| **NestJS 10** | API framework |
| **Fastify** | HTTP server (Express dan tezroq) |
| **Telegraf** | Telegram bot framework |
| **Prisma** | ORM |
| **PostgreSQL** | Asosiy ma'lumotlar bazasi |
| **Redis** | Cache + sessions |
| **JWT + Passport** | Authentication |
| **Zod** | Schema validation |

### Frontend

| Texnologiya | Maqsadi |
|-------------|---------|
| **React 18** | UI library |
| **Vite 5** | Build tool |
| **TailwindCSS 3** | Styling |
| **Redux Toolkit** | Global state |
| **TanStack Query** | Server state |
| **React Router 6** | Routing |
| **Recharts** | Grafiklar |
| **Framer Motion** | Animatsiyalar |
| **Axios** | HTTP client |
| **Lucide Icons** | Iconlar |

---

## 🚀 Ishga tushurish

### Talablar

- **Node.js** ≥ 20.0.0
- **PostgreSQL** ≥ 14
- **Redis** ≥ 7
- **Yarn** yoki **npm**

### 1. Loyihani klonlash

```bash
git clone <repo-url>
cd countlist-ts-node
```

### 2. PostgreSQL va Redis o'rnatish

**Ubuntu / Debian:**

```bash
sudo apt install postgresql redis-server
sudo systemctl start postgresql redis-server
sudo -u postgres createdb expense_tracker
sudo -u postgres psql -c "CREATE USER expense_user WITH PASSWORD 'strong_password';"
sudo -u postgres psql -c "GRANT ALL ON DATABASE expense_tracker TO expense_user;"
```

**macOS (Homebrew):**

```bash
brew install postgresql@15 redis
brew services start postgresql@15
brew services start redis
createdb expense_tracker
```

**Windows:**

- PostgreSQL: <https://www.postgresql.org/download/windows/>
- Redis: WSL ichida yoki <https://github.com/microsoftarchive/redis/releases>

### 3. Telegram Bot Token olish

1. Telegramda [@BotFather](https://t.me/BotFather) ga boring
2. `/newbot` buyrug'ini yuboring
3. Bot uchun **ism** va **username** kiriting (masalan: `MyExpenseBot`)
4. Olingan **token**ni saqlang (`123456:ABC-DEF...`)

### 4. Environment variables

```bash
cp .env.example .env
```

`.env` faylini tahrirlang:

```env
# Telegram Bot
BOT_TOKEN=123456789:AAH_your_real_token_here
ADMIN_TELEGRAM_ID=123456789

# Database
DATABASE_URL=postgresql://expense_user:strong_password@localhost:5432/expense_tracker

# Redis
REDIS_URL=redis://localhost:6379

# API
API_PORT=3001
JWT_SECRET=use-openssl-rand-base64-32-to-generate
JWT_REFRESH_SECRET=use-openssl-rand-base64-32-different

# Web
VITE_API_URL=http://localhost:3001

NODE_ENV=development
```

**Secret generatsiya qilish:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 5. Dependencies o'rnatish

```bash
yarn install
# yoki
npm install
```

### 6. Database migration

```bash
yarn db:generate    # Prisma client generate
yarn db:migrate     # Migration yaratish va ishga tushurish
```

### 7. Default kategoriyalarni seed qilish (ixtiyoriy)

```bash
cd packages/database
npx prisma db seed
```

### 8. Loyihani ishga tushurish

3 ta terminalda parallel:

**Terminal 1 — Bot:**

```bash
yarn bot
# yoki
yarn workspace @expense-tracker/bot dev
```

**Terminal 2 — API:**

```bash
yarn api
# yoki
yarn workspace @expense-tracker/api dev
```

**Terminal 3 — Web:**

```bash
yarn web
# yoki
yarn workspace @expense-tracker/web dev
```

### 9. Tekshirish

- **API:** <http://localhost:3001/api/v1>
- **Swagger:** <http://localhost:3001/api/docs>
- **Dashboard:** <http://localhost:3000>
- **Bot:** Telegramda botingiz orqali

---

## 📱 Telegram Bot sozlash

### 1. Botni guruhga qo'shish

1. Yaratgan botingizni Telegram guruhga qo'shing
2. Guruhda botni **admin** qiling (xabarlarni o'qishi uchun)
3. Guruhda `/start` yuboring

### 2. Privacy mode o'chirish (muhim!)

Bot guruh xabarlarini o'qishi uchun [@BotFather](https://t.me/BotFather) da:

```
/mybots → <bot> → Bot Settings → Group Privacy → Turn off
```

### 3. Komandalarni o'rnatish (ixtiyoriy)

[@BotFather](https://t.me/BotFather) da `/setcommands`:

```
start - Botni ishga tushirish
help - Yordam
today - Bugungi xarajatlar
week - Haftalik statistika
month - Oylik statistika
stats - Umumiy statistika
top - Top kategoriyalar
categories - Kategoriyalar
limit - Limitlarni o'rnatish
balance - Balans
export - Eksport (PDF/CSV/Excel)
settings - Sozlamalar
```

---

## 💡 Foydalanish

### Xarajat qo'shish

Guruhda quyidagicha xabar yuboring:

| Yuborilgan matn | Aniqlangan miqdor | Kategoriya |
|-----------------|-------------------|------------|
| `500000 so'm ovqatga` | 500,000 UZS | 🍕 Oziq-ovqat |
| `2 mln remontga` | 2,000,000 UZS | 🏠 Uy-joy |
| `50k taksi` | 50,000 UZS | 🚗 Transport |
| `100 usd telefonga` | $100 | 💻 Texnologiya |
| `15000 sport` | 15,000 UZS | ⚽ Sport |

### Statistika ko'rish

```
/today    → Bugungi xarajatlar
/week     → Haftalik
/month    → Oylik
/top      → Top 5 kategoriya
/stats    → Umumiy
```

### Limit o'rnatish

`/limit` yuborib, dashboardda batafsil sozlang.

### Dashboard ga kirish

1. Telegramda `/start` bosib **Telegram ID** ni oling
2. <http://localhost:3000/login> ga boring
3. Telegram ID va ismni kiriting
4. Login qiling

---

## 🔌 API Endpoints

To'liq hujjatlar: <http://localhost:3001/api/docs>

### Auth

```
POST   /api/v1/auth/telegram      # Telegram orqali login
POST   /api/v1/auth/refresh       # Token yangilash
POST   /api/v1/auth/logout        # Chiqish
GET    /api/v1/auth/me            # Joriy foydalanuvchi
```

### Expenses

```
GET    /api/v1/expenses                    # List + filter
POST   /api/v1/expenses                    # Qo'shish
GET    /api/v1/expenses/:id                # Bittasini olish
PATCH  /api/v1/expenses/:id                # Yangilash
DELETE /api/v1/expenses/:id                # O'chirish
GET    /api/v1/expenses/stats/:groupId     # Statistika
```

### Analytics

```
GET    /api/v1/analytics/dashboard/:groupId   # Dashboard stats
GET    /api/v1/analytics/full/:groupId        # To'liq analytics
GET    /api/v1/analytics/trends/:groupId      # Trendlar (kunlik/haftalik/oylik)
```

### Categories

```
GET    /api/v1/categories                # Ro'yxat
POST   /api/v1/categories                # Yaratish
PATCH  /api/v1/categories/:id            # Yangilash
DELETE /api/v1/categories/:id            # O'chirish
```

### Groups

```
GET    /api/v1/groups                    # Mening guruhlarim
GET    /api/v1/groups/:id                # Bittasini olish
GET    /api/v1/groups/:id/summary        # Statistika
PATCH  /api/v1/groups/:id/settings       # Sozlamalar (admin)
```

### Limits

```
POST   /api/v1/limits                    # Limit o'rnatish
GET    /api/v1/limits?groupId=&month=    # Ro'yxat (foydalanish bilan)
DELETE /api/v1/limits/:id                # O'chirish
```

### Exports

```
POST   /api/v1/exports/generate          # PDF/CSV/Excel yaratish
```

---

## 📁 Loyiha tuzilmasi

```
countlist-ts-node/
├── apps/
│   ├── bot/                          # 🤖 Telegram Bot
│   │   ├── src/
│   │   │   ├── commands/             # /start, /help, /stats, /export
│   │   │   ├── handlers/             # Callback, message handlers
│   │   │   ├── keyboards/            # Inline keyboards
│   │   │   ├── middlewares/          # Group auto-upsert
│   │   │   ├── services/             # ExpenseService, UserService
│   │   │   ├── types/                # BotContext interface
│   │   │   ├── utils/                # Logger, Redis client
│   │   │   ├── config.ts             # Env config
│   │   │   └── index.ts              # Bot entry point
│   │   └── package.json
│   │
│   ├── api/                          # 🚀 NestJS REST API
│   │   ├── src/
│   │   │   ├── common/
│   │   │   │   ├── decorators/       # @CurrentUser, @Public, @Roles
│   │   │   │   ├── filters/          # Global exception filter
│   │   │   │   ├── guards/           # JwtAuthGuard, RolesGuard
│   │   │   │   └── interceptors/     # Response interceptor
│   │   │   ├── config/               # Configuration
│   │   │   ├── modules/
│   │   │   │   ├── auth/             # JWT auth + strategies
│   │   │   │   ├── expenses/         # CRUD + stats
│   │   │   │   ├── analytics/        # Charts data
│   │   │   │   ├── categories/       # Category management
│   │   │   │   ├── groups/           # Group settings
│   │   │   │   ├── limits/           # Monthly limits
│   │   │   │   └── exports/          # PDF/CSV/Excel
│   │   │   ├── prisma/               # Prisma service
│   │   │   ├── app.module.ts
│   │   │   └── main.ts               # API entry point
│   │   └── package.json
│   │
│   └── web/                          # 💻 React Dashboard
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/               # Card, Button, Badge, StatCard
│       │   │   ├── charts/           # AreaChart, PieChart, BarChart
│       │   │   └── layout/           # Sidebar, Header, DashboardLayout
│       │   ├── pages/                # 10 ta sahifa
│       │   │   ├── LoginPage.tsx
│       │   │   ├── OverviewPage.tsx
│       │   │   ├── ExpensesPage.tsx
│       │   │   ├── AnalyticsPage.tsx
│       │   │   ├── CategoriesPage.tsx
│       │   │   ├── GroupsPage.tsx
│       │   │   ├── LimitsPage.tsx
│       │   │   ├── ExportsPage.tsx
│       │   │   └── SettingsPage.tsx
│       │   ├── store/                # Redux Toolkit slices
│       │   │   ├── slices/
│       │   │   │   ├── auth.slice.ts
│       │   │   │   └── ui.slice.ts
│       │   │   └── index.ts
│       │   ├── services/             # API client, Query client
│       │   ├── hooks/                # useAppSelector
│       │   ├── utils/                # cn(), format()
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── index.css
│       ├── index.html
│       ├── tailwind.config.js
│       ├── vite.config.ts
│       └── package.json
│
├── packages/
│   ├── database/                     # 🗄️ Prisma
│   │   ├── prisma/
│   │   │   └── schema.prisma         # 11 ta jadval
│   │   ├── src/
│   │   │   └── index.ts              # Prisma client singleton
│   │   └── package.json
│   │
│   └── shared/                       # 📦 Shared utilities
│       ├── src/
│       │   ├── types/                # ApiResponse, AnalyticsData, etc.
│       │   ├── schemas/              # Zod schemas
│       │   ├── utils/
│       │   │   └── expense-parser.ts # Natural text parser
│       │   └── index.ts
│       └── package.json
│
├── .env.example                      # Env namuna
├── .gitignore
├── package.json                      # Root workspace config
└── README.md                         # Ushbu fayl
```

---

## 🗄️ Database Schema

11 ta asosiy jadval:

| Jadval | Maqsadi |
|--------|---------|
| `users` | Telegram foydalanuvchilar |
| `groups` | Telegram guruhlar |
| `group_members` | Guruh a'zolari (role bilan) |
| `group_settings` | Har bir guruh sozlamalari |
| `categories` | Xarajat kategoriyalari |
| `expenses` | Xarajatlar (indexed by month/year/week) |
| `monthly_limits` | Oylik limitlar |
| `recurring_expenses` | Takroriy xarajatlar |
| `exports` | Export tarixi |
| `notifications` | Bildirishnomalar |
| `audit_logs` | Audit trail |
| `refresh_tokens` | JWT refresh tokens |

To'liq schema: `packages/database/prisma/schema.prisma`

---

## 🚢 Deployment

### Production build

```bash
yarn build:all
```

### Variantlar

#### Variant 1: VPS (Ubuntu/Debian)

```bash
# 1. Node.js + PostgreSQL + Redis o'rnatish
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs postgresql redis-server

# 2. PM2 process manager
npm install -g pm2

# 3. Loyiha
git clone <repo-url>
cd countlist-ts-node
yarn install
yarn build:all
yarn db:migrate

# 4. PM2 bilan ishga tushurish
pm2 start apps/api/dist/main.js --name expense-api
pm2 start apps/bot/dist/index.js --name expense-bot
pm2 save && pm2 startup

# 5. Nginx reverse proxy
sudo apt install nginx
sudo nano /etc/nginx/sites-available/expense-tracker
```

**Nginx config:**

```nginx
server {
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    server_name dashboard.yourdomain.com;
    root /var/www/expense-tracker/apps/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/expense-tracker /etc/nginx/sites-enabled/
sudo certbot --nginx -d api.yourdomain.com -d dashboard.yourdomain.com
sudo systemctl reload nginx
```

#### Variant 2: PaaS

- **Railway** / **Render** — API + Bot
- **Vercel** / **Netlify** — Web frontend
- **Supabase** / **Neon** — PostgreSQL
- **Upstash** — Redis

### Production checklist

- [ ] `NODE_ENV=production`
- [ ] Kuchli `JWT_SECRET` va `JWT_REFRESH_SECRET`
- [ ] HTTPS (SSL/TLS sertifikat)
- [ ] CORS origins ni cheklash
- [ ] Rate limiting sozlamalari
- [ ] Database backup sxemasi
- [ ] Monitoring (Sentry, DataDog)
- [ ] Webhook URL (polling o'rniga)

---

## 🧪 Testing

```bash
# API tests
yarn workspace @expense-tracker/api test

# E2E tests
yarn workspace @expense-tracker/api test:e2e
```

---

## 🤝 Hissa qo'shish

1. Fork
2. Feature branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Pull Request

---

## 📜 License

MIT License

---

## 🆘 Yordam

| Muammo | Yechim |
|--------|--------|
| Bot xabarlarni ko'rmayapti | Privacy mode'ni o'chiring (@BotFather) |
| `prisma generate` xatolik | `cd packages/database && npx prisma generate` |
| Port 3001 band | `.env` da `API_PORT` ni o'zgartiring |
| CORS xatolik | API ning `main.ts` da `origin` ni qo'shing |
| Redis ulanmayapti | `redis-cli ping` bilan tekshiring |

---

## 📞 Kontakt

- 🐛 Issues: GitHub Issues
- 📧 Email: support@yourdomain.com
- 💬 Telegram: @your_support_bot

---

**Made with ❤️ in Uzbekistan 🇺🇿**
