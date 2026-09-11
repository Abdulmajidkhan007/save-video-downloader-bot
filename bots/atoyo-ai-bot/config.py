import os
from dotenv import load_dotenv

load_dotenv()

API_ID = int(os.getenv("API_ID", 0))
API_HASH = os.getenv("API_HASH", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

SOURCE_GROUP_ID = int(os.getenv("SOURCE_GROUP_ID", 0))
TARGET_GROUP_ID = int(os.getenv("TARGET_GROUP_ID", 0))
AI_TOPIC_ID = int(os.getenv("AI_TOPIC_ID", 0))
