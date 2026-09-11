import io
import os
import asyncio
import google.genai as genai
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

# Barcha kalitlarni ro'yxatga olish
API_KEYS = [k.strip() for k in os.getenv("GEMINI_API_KEYS", os.getenv("GEMINI_API_KEY", "")).split(",") if k.strip()]
current_key_idx = 0


def get_ai_client():
    global current_key_idx
    key = API_KEYS[current_key_idx]
    return genai.Client(api_key=key)


SYSTEM_PROMPT = """
Sen santexnika do'koni uchun katalog tuzuvchi mutaxassissan.
Berilgan rasm va matnni tahlil qilib, AYNAN quyidagi shablonda chiqar.

QAT'IY QOIDALAR:
1. Valyuta kursi: 1$ = 12 100 so'm.
2. Narx dollar ($) da bo'lsa, uni 12 100 ga ko'paytirib, faqat SO'MDA butun son qilib yoz (hech qayerda $ belgisi qolmasin).
3. Tannarx: matnda bo'lmasa, sotish narxining 85% miqdorini yaxlitlab so'mda yoz.
4. Ortiqcha gap qo'shma.

Shablon:
Nomi: [Mahsulotning to'liq nomi]
Kodi: [Model yoki kodi]
Kategoriya: [Hammom aksessuarlari / Smesitellar / Oshxona moykalari / Oynalar]
Tannarx: [Faqat raqam so'mda]
Narx: [Faqat raqam so'mda]
Soni: 1
Kimdan: Atoyo
Davlat: [Xitoy yoki O'zbekiston]
Sotish turi: dona
Tavsif: [Foydalanish uchun qulay, materiali va o'lchami haqida ixcham 1 qator tavsif]
"""


async def process_catalog_item(image_bytes: bytes, caption: str) -> str:
    global current_key_idx
    img = Image.open(io.BytesIO(image_bytes))

    # Mavjud barcha kalitlarni aylanib chiqish
    for _ in range(len(API_KEYS)):
        try:
            client = get_ai_client()
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=[SYSTEM_PROMPT, f"Xom ma'lumot: {caption}", img]
            )
            return response.text.strip()
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                # Keyingi kalitga o'tish
                current_key_idx = (current_key_idx + 1) % len(API_KEYS)
                print(f"⚠️ Kalit limiti tugadi. {current_key_idx + 1}-kalitga o'tildi...")
                await asyncio.sleep(1)
            else:
                print(f"Boshqa xato: {e}")
                await asyncio.sleep(2)

    return ""
