# CLAUDE.md — ishlash qoidalari

> Bu fayl **har sessiyada o'qiladi**. Shuning uchun qisqa: faqat **qoidalar** va **xarita**.
> «Nima uchun shunday qilingan» — [`docs/ARXITEKTURA-TARIXI.md`](docs/ARXITEKTURA-TARIXI.md) da.
> Hajm chegarasi: **15–20 KB**. Oshsa — tarixga ko'chiring, bu yerga qisqartma qoldiring.

---

## 🥇 Ikkita oltin qoida

1. **Taxmin qilma — o'lchab ko'r.** «Ehtimol shundandir» degan gap yechim emas.
   Log qo'y, `--version` chiqar, `-F` bilan ro'yxatni ko'r, testda tekshir.
   Sabab aniqlanmaguncha tuzatish yozilmaydi.
2. **Xato jim yutilmaydi.** Bo'sh `catch {}` yoki `except: pass` — taqiqlanadi.
   Har `catch` yo log qiladi, yo yuqoriga uzatadi. Foydalanuvchiga **nima
   bo'lganini** ayting, «xatolik yuz berdi» emas.

---

## 🗺 Repo xaritasi

```
bots/<id>/          har bir bot — MUSTAQIL loyiha (o'z package.json / requirements.txt,
                    o'z .env.example, o'z README.md). Root'ga bog'liq emas.
bots.json           botlar ro'yxati: id, runtime, install, start, autoStart
tools/run.js        boshqaruvchi CLI — list / setup / install / start / doctor
tools/registry.js   bots.json ustidagi TOZA mantiq (I/O yo'q → test qilinadi)
tools/scan-secrets.js  kalit tekshiruvi (repo public!)
tools/registry.test.js testlar
docs/ARXITEKTURA-TARIXI.md  qarorlar tarixi
```

**10 ta bot:** `save-video-downloader-bot`, `anonim-bot`, `arxiv-topadi-bot`,
`gemini-qa-bot`, `idfinder-bot`, `malware-bot`, `quiz-bot` (Node) ·
`killspam-bot`, `xulosa-ai-bot` (Python) · `countlist-ts-node` (TypeScript monorepo).

---

## 🔒 Xavfsizlik (repo PUBLIC)

- **`.env` hech qachon commit qilinmaydi.** Faqat `.env.example` — bo'sh yoki
  namuna qiymatlar bilan (`BU_YERGA_YOZING`, `your_key_here`).
- Kalit, token, parol — **faqat env orqali**. Kodga yozilmaydi, log'ga chiqarilmaydi.
- Yangi env o'zgaruvchi qo'shsangiz — **o'sha zahoti `.env.example` ga ham** qo'shing.
- Tashqi buyruq chaqirilganda **`execFile`/`spawn` (shell:false)** ishlatiladi,
  `exec` emas — foydalanuvchi bergan URL/matn shellga tushmasin.
- Foydalanuvchi bergan `callback_data`, ID va yo'llar — **doim tekshiriladi**.
- Commit'dan oldin: `npm run scan`.

---

## ✅ Majburiy tekshiruv zanjiri (commit'dan oldin)

Tartib bilan, hammasi yashil bo'lmaguncha commit yo'q:

```bash
npm test          # 1. testlar o'tadimi
npm run scan      # 2. kalit qolib ketmadimi
npm run doctor    # 3. muhit joyidami (ixtiyoriy, lokal)
node -c ...       # 4. o'zgargan botni haqiqiy ishga tushirib ko'ring
```

O'zgartirgan botni **haqiqatan ishga tushiring** va o'zgargan yo'lni bosib ko'ring.
«Ishlashi kerak» — tekshiruv emas.

Qadamlardan biri yiqilsa: **avval sababni toping**, testni o'chirib tashlamang.

---

## 🧪 Test qoidalari

- **Toza mantiqni test qiling:** parsing, format tanlash, limit hisobi, validatsiya,
  matn kesish. Bularda tashqi xizmat kerak emas.
- **Tashqi xizmatni mock qiling:** Telegram API, Gemini, VirusTotal, yt-dlp, baza.
  Test internetga chiqmasin.
- **Har tuzatilgan bug uchun — regressiya testi.** Test avval yiqilishi kerak edi,
  tuzatishdan keyin o'tsin. Aks holda bug qaytib keladi.
- Test tez bo'lsin (sekundlar). Sekin test yozilmaydi va ishlatilmaydi.
- Node'da `node:test` + `node:assert` yetarli — qo'shimcha kutubxona shart emas.

---

## 📐 Kod uslubi

- **Node botlari: CommonJS** (`require`), `'use strict'`. Bir bot ichida uslub aralashmaydi.
- Izohlar — **o'zbekcha**, «nima uchun» ni tushuntiradi, «nima qilyapti» ni emas.
- Atrofdagi kodga o'xshating: nomlash, izoh zichligi, papka tuzilishi.
- Fayl 400–500 qatordan oshsa — bo'ling.
- JSON saqlashda **atomik yozuv**: `.tmp` ga yozib, keyin `fs.renameSync`.
- Bot papkasi mustaqil qolsin: `bots/x` dan `bots/y` ga `require` qilinmaydi.

---

## 🧩 Yangi bot qo'shish

1. `bots/<id>/` — kod + `.env.example` + `README.md` (+ `.gitignore`).
2. `bots.json` ga yozuv: `id`, `name`, `desc`, `runtime`, `install`, `start`,
   `autoStart` (qo'shimcha xizmat kerak bo'lsa `false`), `requires`, `note`.
3. `npm run check` — testlar papka va `.env.example` borligini tekshiradi.

---

## 📋 Vazifa shabloni

Har jiddiy o'zgarish shu tartibda:

```
1. MUAMMO      — nima ishlamayapti / nima kerak (aniq, o'lchanadigan)
2. SABAB       — o'lchov natijasi (log, chiqish, test). Taxmin emas.
3. YECHIM      — nima o'zgaradi, qaysi fayllarda
4. XAVF        — nima buzilishi mumkin, qanday qaytariladi
5. TEKSHIRUV   — qanday tekshirildi (buyruq + natija)
```

Sabab topilmasa — 3-qadamga o'tilmaydi. Avval o'lchov qo'shiladi.

---

## 🤖 Model tanlash

| Vazifa | Model |
|--------|-------|
| Arxitektura, ko'p faylli refaktor, chigal bug | eng kuchli model |
| Oddiy tuzatish, README, izoh, kichik funksiya | tezroq/arzonroq model |
| Katta loglarni saralash, qidiruv | tezkor model |

Chigal bugni arzon modelga topshirib, keyin qayta yozib chiqishdan ko'ra —
darrov kuchli modelga berish arzonroq.

---

## 🚫 Qilinmaydi

- `.env` ni commit qilish, kalitni kodga yozish
- Bo'sh `catch {}` / `except: pass`
- `exec` bilan foydalanuvchi matnini shellga uzatish
- Sababi aniqlanmagan «ehtimol shu» tuzatishlari
- Testni o'chirib qo'yib «yashil» qilish
- Bot papkalari o'rtasida bog'liqlik yaratish
- So'ralmagan katta refaktorni ilova qilish
