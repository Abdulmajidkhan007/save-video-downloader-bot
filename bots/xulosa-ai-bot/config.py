import os
from dotenv import load_dotenv

# .env faylidan ma'lumotlarni o'qish
load_dotenv()

# Telegram API ma'lumotlari (my.telegram.org)
API_ID = os.getenv("API_ID")
# API_ID int bo'lishi kerak, shuning uchun o'tkazamiz
if API_ID:
    API_ID = int(API_ID)
API_HASH = os.getenv("API_HASH", "")

# Bot Token (@BotFather) - faqat 4-usul uchun
BOT_TOKEN = os.getenv("BOT_TOKEN", "")

# String Session - faqat 3-usul uchun
STRING_SESSION = os.getenv("STRING_SESSION", "")

# Gemini AI API Kaliti (Google AI Studio)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Bot Egasi va Boshqaruv sozlamalari
ADMIN_ID = os.getenv("ADMIN_ID")
if ADMIN_ID:
    ADMIN_ID = int(ADMIN_ID)

REQUIRED_CHANNEL = os.getenv("REQUIRED_CHANNEL", "")  # Majburiy a'zolik kanali (yoki bo'sh qoldiring)
CARD_NUMBER = os.getenv("CARD_NUMBER", "")
SUB_PRICE = os.getenv("SUB_PRICE", "")
