# 🤖 Telegram Guruh va Kanallar Xulosachi AI Boti (SaaS)

Ushbu bot Telegram guruhlari, ochiq kanallar va xabar havolalaridagi yozishmalar, ovozli va video xabarlarni Google Gemini AI yordamida tahlil qilib, qisqa xulosa beradi.

## ⚙️ O'rnatish va Ishga Tushirish

1. **Repozitoriyni yuklab oling yoki fayllarni nusxalang.**

2. **Kutubxonalarni o'rnatish:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Sozlamalarni kiritish:**
   Loyihaning asosiy papkasida `.env` nomli fayl uning ichiga o'z ma'lumotlaringizni kiriting. Siz `.env.example` faylidan namuna sifatida foydalanishingiz mumkin:
   ```env
   API_ID=sizning_api_id
   API_HASH="sizning_api_hash"
   BOT_TOKEN="sizning_bot_token"
   STRING_SESSION="agar_userbot_session_bor_bosa"
   GEMINI_API_KEY="sizning_gemini_api_kalitingiz"
   ADMIN_ID=sizning_telegram_id_raqamingiz
   REQUIRED_CHANNEL="@kanal_username"
   CARD_NUMBER="8600 0000 0000 0000 (Ism Familiya)"
   SUB_PRICE="50,000 so'm / oyiga"
   ```

4. **Botni ishga tushirish:**
   ```bash
   python main.py
   ```
   Ishga tushirish jarayonida konsolda qaysi usul bilan kirishni tanlashingiz so'raladi (Userbot, Bot, Sessiya va h.k).

---

### 📦 Ushbu Loyihani ZIP Qilib Jamlash Buyrug‘i (Linux/Termux)

Barcha fayllarni avtomatik tarzda bitta `telegram_ai_bot.zip` arxiviga joylaydi:

```bash
zip -r telegram_ai_bot.zip config.py database.py main.py requirements.txt README.md .env.example .gitignore
```

### 📱 Termux da o'rnatish bo'yicha to'liq qo'llanma

```bash
pkg update && pkg upgrade -y
pkg install proot-distro git nano zip unzip -y

proot-distro install ubuntu
proot-distro login ubuntu

apt update && apt upgrade -y
apt install python3 python3-pip python3-venv nano git -y

mkdir bot_loyiha
cd bot_loyiha
python3 -m venv bot_env
source bot_env/bin/activate

# Fayllarni shu yerga qo'yib:
pip install -r requirements.txt

# Va ishga tushiring:
python3 main.py
```

---

**Muallif:** [@Abdulloh_77700](https://t.me/Abdulloh_77700)
