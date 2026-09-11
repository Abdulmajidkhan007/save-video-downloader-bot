# 3 oylik reja — yangi loyiha yo'q, boshlanganlarini tugatamiz

> **Muddat: 2026-09-11 → 2026-12-11**
>
> Bu reja faqat shu repo uchun emas — **barcha loyihalar** uchun. Shu yerda turibdi,
> chunki bu repo endi asosiy ish maydoni va `CLAUDE.md` har sessiyada o'qiladi.

---

## Qoida

**Bu muddat ichida yangi repo ochilmaydi.** Yangi g'oya kelsa — pastdagi
«G'oyalar qutisi» ga yoziladi, kod yozilmaydi.

Sababi o'lchovga asoslangan: 2026-05-03 dan 2026-09-11 gacha **30 ta repo**
ochilgan, ulardan **jonli havolasi bor — bittasi** (`atoyo-e-commerce` →
atoyo-uz.web.app). Muammo qurish tezligida emas, **tugatishda**.

«30 ta repo» hech kimni hayratlantirmaydi. «Mana mahsulot, mana havolasi,
mana foydalanuvchilari» — hammasini o'zgartiradi.

---

## «Tugallandi» nimani bildiradi

Loyiha quyidagi **beshtasi ham** bo'lmaguncha tugallanmagan hisoblanadi:

1. **Deploy qilingan** — ishlaydigan havola bor (Netlify / Vercel / Railway / Firebase)
2. **README to'g'ri** — havola, skrinshot, o'rnatish qadamlari haqiqatan ishlaydi
3. **`.env.example` bor**, `.env` va sirlar repoda yo'q
4. **Begona odam ishga tushira oladi** — README bo'yicha, savol bermasdan
5. **Kamida 1 ta haqiqiy foydalanuvchi** — o'zingiz emas

«Kod yozildi» ≠ tugallandi. «Ishlashi kerak» ≠ tekshirildi.

---

## Navbat (tugashiga yaqinligi bo'yicha)

Eng yaqinini birinchi — g'alaba tezroq keladi, kuch beradi.

| # | Loyiha | Hozirgi holat | Shu 3 oyda nima bo'lishi kerak |
|---|---|---|---|
| 1 | `rn-r-e-commerce` (KidsWear) | «Phase 8a» — brend, legal, SEO, `netlify.toml` tayyor | **Netlify'ga deploy.** Faqat web. Mobil keyinroq |
| 2 | `portfolio-3d` | Lighthouse 97, testlar bor, kontent — namuna | **Haqiqiy kontent + deploy.** Bu sizning CV'ingiz — birinchi navbatda kerak |
| 3 | `telegram-bots` (shu repo) | 11 ta bot, monorepo tayyor | Public qilish, eski 9 repo o'chirish, 2–3 botni **doimiy** ishlatish |
| 4 | `learning-datacenter-tc-project` | «Faza 0» — 46 jadval, RBAC, Docker | **Faza 1:** guruhlar, jadval, davomat. Bitta maktabga demo ko'rsatish |
| 5 | `go-uz` (Vroom) | 9 paket qurilgan, ilovalar «in progress» | **Bitta** ilovani tanlang (web yoki mobil), MVP darajasida ishga tushiring |

### Muzlatilganlar (bu 3 oyda tegilmaydi)

- `DevCraft-AI` — faqat `ARCHITECTURE.md` bor, kod yo'q. G'oya kuchli, lekin
  hozir boshlansa navbatdagilarni yana cho'zadi.
- `ios-asistent` (Salom AI) — katta g'oya, lekin ovozli AI eng qimmat va
  eng uzoq yo'l. Navbat bo'shaganda.

---

## Arxivlash / tozalash ro'yxati

Profil toza bo'lsin — begona odam 30 ta repodan qaysi biri jiddiy ekanini
ajrata olmaydi.

**Aniq (tekshirildi):**

| Repo | Nega | Nima qilish |
|---|---|---|
| `first-bot` | Bo'sh (0 KB), README'da bitta qator | O'chirish |
| `asistent-bot` | Bo'sh (0 KB), private | O'chirish |
| `portfolio-builder` | Faqat umumiy README, kod yo'q | O'chirish |
| `atoyo` | `atoyo-e-commerce` ning eski versiyasi (React+Vite → Next.js 16) | Arxivlash |
| `chatapp` | README hali ham Create React App shabloni | Arxivlash |
| `e-commerce-platform` | Uchinchi e-commerce; `atoyo-e-commerce` undan kuchli | Arxivlash |

**Qaror sizniki:**

- `countlist` (Python: aiogram + FastAPI + Whisper) va `countlist-ts-node`
  (TypeScript: NestJS + Prisma) — **bitta mahsulot, ikki stek**. Ikkalasi ham
  jiddiy yozilgan. Bittasini tanlab, ikkinchisini arxivlash kerak.
- `calculator`, `bank`, `taxi`, `social-app`, `chat-app` — o'quv loyihalari.
  Saqlash yomon emas, lekin README'ga «o'quv loyihasi» deb yozib qo'ying,
  shunda ular jiddiy ish bilan aralashmaydi.

> Arxivlash ≠ o'chirish. GitHub → Settings → Archive this repository.
> Repo qoladi, faqat «Archived» belgisi bilan — tahrirlab bo'lmaydi va
> profilda ajralib turmaydi.

---

## G'oyalar qutisi

Yangi g'oya kelsa — **shu yerga yoziladi, repo ochilmaydi.** 2026-12-11 dan
keyin qaytib ko'riladi.

<!-- Yangi g'oyalarni shu yerga qo'shing: sana + bir qator tavsif -->

- _(hozircha bo'sh)_

---

## Har hafta tekshiruv

Dushanba kuni shu uchta savolga javob yozing (shu faylga yoki kanalga):

1. O'tgan haftada **navbatdagi** loyihada nima tugadi?
2. Nima to'sqinlik qildi?
3. Shu haftada qaysi bitta narsa tugaydi?

Uchala javob ham «navbatdagi loyiha» haqida bo'lishi kerak. Boshqa loyihaga
o'tib ketilgan bo'lsa — sabab yozilsin.
