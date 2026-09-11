# 🛒 Atoyo AI Katalog Userbot

Santexnika do'koni uchun **Telegram userbot**. Manba guruhga tashlangan mahsulot
rasmlarini ushlaydi, **Google Gemini** bilan tahlil qilib tayyor katalog
kartochkasi (nomi, kodi, kategoriya, tannarx, narx, tavsif) yasaydi va
maqsad guruhning belgilangan **topic** iga joylaydi.

> ⚠️ Bu **bot emas, userbot** — BotFather tokeni bilan emas, shaxsiy
> Telegram akkauntingiz orqali ishlaydi (Telethon). Shuning uchun `API_ID` va
> `API_HASH` kerak, `BOT_TOKEN` emas.

## ✨ Imkoniyatlar

- **Avtomatik kuzatuv** — manba guruhga yangi rasm tushsa, darrov kartochka yasaladi (`handlers/listener.py`)
- **Qidiruv** — maqsad topicga so'z yozsangiz, arxivdan o'shanga mos mahsulotlarni topib chiqaradi (`handlers/command_handler.py`)
- **Dublikat filtri** — rasmlar **pHash** bilan solishtiriladi, bir xil mahsulot ikki marta joylanmaydi (`services/dedup_service.py`)
- **Ko'p kalitli Gemini** — bir kalit limitga (`429`) yetsa, avtomatik keyingisiga o'tadi (`services/ai_service.py`)
- **Arxivni ko'chirish** — `history.py` eski postlarni ketma-ket qayta ishlaydi, qayerda to'xtaganini `processed_ids.txt` da eslab qoladi

## 📁 Tuzilishi

```
main.py                      kirish nuqtasi — userbotni ishga tushiradi
config.py                    .env dan sozlamalarni o'qiydi
get_topic.py                 yordamchi: guruhdagi topic ID larini chiqaradi
history.py                   yordamchi: eski arxivni to'plab qayta ishlaydi
handlers/listener.py         yangi postlarni ushlaydi
handlers/command_handler.py  topicdagi qidiruv so'rovlarini bajaradi
services/ai_service.py       Gemini bilan kartochka matnini yasaydi
services/dedup_service.py    pHash orqali dublikat aniqlash
```

## 🚀 O'rnatish

```bash
cd bots/atoyo-ai-bot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
nano .env          # API_ID, API_HASH, GEMINI_API_KEY, guruh ID larini yozing
```

`API_ID` va `API_HASH` — https://my.telegram.org → API development tools.
`GEMINI_API_KEY` — https://aistudio.google.com/apikey

### Topic ID ni topish

`AI_TOPIC_ID` ni qo'lda bilish qiyin — shuning uchun yordamchi skript bor:

```bash
python get_topic.py
```

Chiqqan ro'yxatdan kerakli topicning ID sini `.env` ga yozing.

### Ishga tushirish

```bash
python main.py
```

Birinchi ishga tushirishda Telethon telefon raqami va kodni so'raydi, so'ng
`atoyo_admin_session.session` faylini yaratadi.

Eski arxivni bir marta ko'chirish uchun (alohida sessiya bilan ishlaydi):

```bash
python history.py
```

## 🔒 Xavfsizlik — sessiya fayli

`*.session` fayli **akkauntingizga to'liq kirish huquqini** beradi: kim olsa,
parolsiz kiradi. Shuning uchun:

- `.gitignore` uni bloklaydi — hech qachon commit qilinmaydi
- Hech kimga yubormang, arxivga qo'shmang
- Tasodifan tarqalgan bo'lsa: Telegram → **Settings → Devices → Terminate all
  other sessions**, so'ng `API_HASH` ni yangilang

## ⚙️ Sozlamalar (`.env`)

| O'zgaruvchi | Nima |
|---|---|
| `API_ID`, `API_HASH` | my.telegram.org dan olinadigan akkaunt kalitlari |
| `GEMINI_API_KEY` | Bitta Gemini kaliti |
| `GEMINI_API_KEYS` | Ixtiyoriy: bir nechta kalit, vergul bilan. Limitga yetganda navbat bilan almashadi |
| `SOURCE_GROUP_ID` | Mahsulot postlari kuzatiladigan guruh |
| `TARGET_GROUP_ID` | Kartochkalar yuboriladigan forum-guruh |
| `AI_TOPIC_ID` | O'sha guruh ichidagi topic (`get_topic.py` topib beradi) |

## 📝 Eslatmalar

- Gemini modeli `services/ai_service.py` ichida qattiq yozilgan (`gemini-3.6-flash`).
- Kartochka shabloni va valyuta kursi ham o'sha fayldagi `SYSTEM_PROMPT` da —
  narx o'zgarsa shu yerdan tahrirlang.
- Telegram limitiga urilmaslik uchun har post orasida 4 soniya kutiladi.

---

**Muallif:** [@Abdulloh_77700](https://t.me/Abdulloh_77700)
