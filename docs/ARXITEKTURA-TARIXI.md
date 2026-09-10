# Arxitektura tarixi — nima uchun shunday qilingan

`CLAUDE.md` da **qoidalar** bor. Bu yerda — **sabablar**. Yangi qaror qabul
qilinganda shu faylga qo'shiladi, eskisi o'chirilmaydi (tarix yo'qolmasin).

---

## 1. Nega monorepo?

**Muammo.** 10 ta bot 10 ta alohida repoda edi. Yangi qurilmada (Termux, Kali,
Ubuntu) ishlash uchun har birini alohida `git clone` qilish, alohida sozlash,
alohida eslab qolish kerak edi. Qaysi bot qayerda — chalkashlik.

**Qaror.** Hammasi bitta repoda, lekin **`bots/<id>/` ostida to'liq mustaqil**
loyihalar sifatida.

**Nega aynan shunday:**

- *Bitta `git clone` — hamma bot.* Asosiy talab shu edi.
- *Papkalar mustaqil.* Kelajakda birini ajratib olish kerak bo'lsa,
  `cp -r bots/quiz-bot ~/` yetarli — root faylga bog'liqlik yo'q.
- *Umumiy kod ajratilmadi.* «Umumiy kutubxona» qilish vasvasasi bor edi
  (obuna tekshirish, rate limit, JSON saqlash — bir necha botda takrorlanadi).
  **Qilinmadi:** shunda papkalar mustaqilligini yo'qotardi va bitta botdagi
  o'zgarish boshqasini buzishi mumkin edi. Takrorlanish — bu yerda ataylab
  to'langan narx.
- *npm/yarn workspaces ishlatilmadi.* Sabab: botlar aralash (Node + Python +
  TypeScript), workspaces faqat Node'ni qamrab olardi va har botni alohida
  deploy qilishni murakkablashtirardi.

## 2. Nega `bots.json` + `tools/run.js`, framework emas?

**Muammo.** «Hammasini birdan ishga tushirish» va «bittasini ishga tushirish» kerak.
Tayyor yechimlar bor: pm2, docker-compose, Turborepo, Nx.

**Qaror.** ~200 qatorlik toza Node skript + oddiy JSON ro'yxat.

**Nega:**

- Repo public va turli qurilmalarda (Termux ham) ishlashi kerak. `tools/run.js`
  **hech qanday kutubxonaga bog'liq emas** — root'da `npm install` qilish shart emas.
- Docker Termux'da og'ir. pm2 — qo'shimcha global o'rnatish.
- `bots.json` — bir qarashda tushunarli: qaysi bot, qaysi til, qanday ishga tushadi.
- Buyruqlar `spawn(cmd, args, { shell: false })` bilan chaqiriladi — shell orqali
  emas. Shuning uchun `bots.json` da buyruq **massiv** ko'rinishida saqlanadi
  (`["node", "src/bot.js"]`), satr emas.

**`autoStart: false` nega kerak bo'ldi.** `killspam-bot` PostgreSQL, `countlist-ts-node`
PostgreSQL + Redis, `xulosa-ai-bot` esa userbot `STRING_SESSION` talab qiladi.
`npm start` ularni ishga tushirsa — hamma safar xato bilan yiqilardi va boshqa
botlarning logini ko'mib tashlardi. Shuning uchun ular ro'yxatda `[qo'lda]`
belgisi bilan turadi; `npm run start:all` bilan majburan ishga tushiriladi.

## 3. Nega `tools/registry.js` alohida fayl?

`run.js` jarayon ochadi, fayl o'qiydi, signal ushlaydi — buni test qilish qiyin.
Shuning uchun **toza mantiq** (validatsiya, nishonni hal qilish) `registry.js` ga
ajratildi: I/O yo'q → 16 ta test sekundlarda o'tadi.

Bu `CLAUDE.md` dagi «toza mantiqni test qil, tashqi xizmatni mock qil» qoidasining
amaliy ko'rinishi.

## 4. Nega kalit tekshiruvi alohida skript?

**Muammo.** Repo **public** bo'ladi. Bitta unutilgan token — bot o'g'irlanadi,
Gemini kaliti sarflanadi. Ko'z bilan tekshirish ishonchsiz: 300+ fayl.

**Qaror.** `tools/scan-secrets.js` — commit'dan oldin va CI'da ishlaydi.

**O'lchov natijasi (taxmin emas).** Birinchi versiya `^\s*KEY=value$` regex bilan
yozildi va 11 ta **noto'g'ri** ogohlantirish berdi: `\s*` yangi qatorni ham
yutgani uchun keyingi qatorni «qiymat» deb o'qidi, hamda
`BOT_TOKEN = os.getenv("BOT_TOKEN")` kabi kod satrlarini sir deb hisobladi.

**Tuzatish:** env qoidasi endi faqat `.env*` fayllarga qo'llanadi va satrma-satr
tahlil qilinadi (`findFilledEnvSecrets`), regex bilan emas. Namuna qiymatlar
(`your_key_here`, `BU_YERGA_YOZING`, `xxxx`, `<...>`) o'tkazib yuboriladi.
Kalit **shakllari** (Telegram token, `AIza…`, `sk-…`, `ghp_…`, `AKIA…`,
private key bloki) esa har qanday faylda qidiriladi.

Har ikkala holat uchun ham regressiya testi yozildi — noto'g'ri ogohlantirish
qaytib kelmasin.

**Natija:** 308 fayl tekshirildi, sir topilmadi. Repo public bo'lishga tayyor.

## 5. Nega root `.gitignore` da `**/data/*`?

Bir necha bot (`anonim-bot`, `malware-bot`) ish vaqtida `data/*.json` yozadi,
lekin papkaning o'zi repoda turishi kerak (`.gitkeep`). Oddiy `data/` naqshi
papkani butunlay chiqarib tashlardi va git ichiga kirmasdi — `.gitkeep` ham
yo'qolardi. `**/data/*` + `!**/data/.gitkeep` juftligi papkani saqlab,
ichidagi ma'lumotni chiqarib tashlaydi.

Xuddi shunday `.env.*` bloklanadi, lekin `!.env.example` bundan mustasno.

## 6. Video downloader botidan olingan saboqlar

Bu bot monorepo'gacha uzoq tuzatishlar bosqichidan o'tdi. Saboqlar qoidalarga
aylandi:

**a) «Requested format is not available» — DASH.** YouTube video va audioni
alohida oqim qilib beradi. `best` (bitta birlashgan format) so'ralganda hech
narsa topilmasdi. Yechim: `bv*+ba` bilan birlashtirish. → *Taxmin qilma,
`yt-dlp -F` bilan ro'yxatni ko'r.*

**b) Faqat `sb0..sb3` formatlar qaytdi.** Bu storyboard rasmlari — ya'ni
YouTube datacenter IP'ni (Railway) bloklagan. Kodda hal qilib bo'lmaydi:
residential proxy yoki uy IP'si kerak. → *Ba'zi muammo kod muammosi emas;
o'lchov buni ko'rsatadi.*

**c) `--ffmpeg-location ffmpeg` xato edi.** yt-dlp bu bayroqni **yo'l** deb
qabul qiladi, PATH'dan qidirmaydi. Natijada uy qurilmasida MP3 ishlamadi.
Yechim: bayroq faqat haqiqiy mavjud yo'l uchun beriladi. → *Tashqi vositaning
hujjatini o'qib tekshir, nom bilan yo'lni aralashtirma.*

**d) `.env` da `YTDLP_PATH=./bin/yt-dlp` qolib ketgan edi.** Railway uchun
yozilgan yo'l uy qurilmasida yo'q → `ENOENT`. Yechim: `resolveBinary()` —
env → `bin/` → tizimdagi PATH tartibida qidiradi va mavjud bo'lmagan yo'lni
e'tiborsiz qoldiradi. `.env.example` da esa bu qiymatlar **bo'sh** qoldirilgan.
→ *Namuna faylga muhitga xos yo'l yozilmaydi.*

**e) webm hujjat bo'lib keldi.** Telegram faqat mp4 (H.264/AAC) ni ichida
o'ynatadi. Yechim: format tanlashda mp4/avc1/m4a birinchi, so'ng
`--remux-video mp4`. → *«Yuklandi» — «ishladi» degani emas; natijani
foydalanuvchi ko'rgan holatda tekshir.*

## 7. Deploy: nega Root Directory?

Monorepo'dan keyin Railway repo ildizini quradi va `bots/` ichidagi
`package.json` ni topmaydi. Har servis uchun **Settings → Root Directory →
`bots/<id>`** qo'yiladi. Shunda har bot alohida servis bo'lib, o'z
Variables to'plamiga ega bo'ladi — kalitlar aralashmaydi.

---

## Keyingi qadamlar (ochiq savollar)

- Lokal qurilmalardagi (Termux/Kali/Ubuntu) botlarni ham shu repoga qo'shish.
- Eski 9 ta repo o'chirilgandan keyin bu repo nomini `telegram-bots` ga
  o'zgartirish (GitHub eski havolalarni yo'naltiradi).
- `killspam-bot` va `countlist-ts-node` uchun `docker-compose.yml` qo'shish
  kerakmi — hozircha yo'q, chunki Termux'da og'irlik qiladi.
