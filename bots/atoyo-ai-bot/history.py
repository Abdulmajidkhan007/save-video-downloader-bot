import io
import os
import asyncio
from datetime import datetime, timezone
from telethon import TelegramClient
from config import API_ID, API_HASH, SOURCE_GROUP_ID, TARGET_GROUP_ID, AI_TOPIC_ID
from services.ai_service import process_catalog_item
from services.dedup_service import Deduplicator

client = TelegramClient("atoyo_history_session", API_ID, API_HASH)
dedup = Deduplicator()

# Faqat 2026-yilgi postlar uchun chegara
START_DATE = datetime(2026, 1, 1, tzinfo=timezone.utc)
CACHE_FILE = "processed_ids.txt"


def get_processed_ids():
    if not os.path.exists(CACHE_FILE):
        return set()
    with open(CACHE_FILE, "r") as f:
        return set(line.strip() for line in f if line.strip())


def save_processed_id(msg_id):
    with open(CACHE_FILE, "a") as f:
        f.write(f"{msg_id}\n")


async def sync_recent_messages():
    await client.start()
    processed_ids = get_processed_ids()
    print(f"Boshlandi. Bazada oldin ishlangan {len(processed_ids)} ta xabar mavjud.")

    processed_count = 0
    duplicate_count = 0

    async for message in client.iter_messages(SOURCE_GROUP_ID):
        # 2026-yildan eski postlarga yetsa to'xtaydi
        if message.date < START_DATE:
            print("2026-yildan oldingi arxivga yetib kelindi. Yakunlandi.")
            break

        # Agar bu post oldin tashlangan bo'lsa, o'tkazib yuborish
        if str(message.id) in processed_ids:
            continue

        if message.photo:
            try:
                photo_bytes = await message.download_media(file=bytes)

                if dedup.is_duplicate(photo_bytes):
                    save_processed_id(message.id)
                    duplicate_count += 1
                    continue

                caption = message.text or ""
                card_text = await process_catalog_item(photo_bytes, caption)

                if not card_text:
                    continue

                photo_stream = io.BytesIO(photo_bytes)
                photo_stream.name = "product.jpg"

                await client.send_file(
                    entity=TARGET_GROUP_ID,
                    file=photo_stream,
                    caption=card_text,
                    reply_to=int(AI_TOPIC_ID)
                )

                save_processed_id(message.id)
                processed_count += 1
                print(f"[{processed_count}] Joylandi: {caption[:25]}... (ID: {message.id})")

                await asyncio.sleep(4)

            except Exception as e:
                print(f"Xatolik: {e}")
                await asyncio.sleep(5)

    print(f"\nNatija: {processed_count} ta joylandi, {duplicate_count} ta dublikat o'tkazildi.")


if __name__ == "__main__":
    asyncio.run(sync_recent_messages())
