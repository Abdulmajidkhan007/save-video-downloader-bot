import io
from telethon import events
from config import SOURCE_GROUP_ID, TARGET_GROUP_ID, AI_TOPIC_ID
from services.ai_service import process_catalog_item
from services.dedup_service import Deduplicator

dedup = Deduplicator()


def register_listener(client):
    @client.on(events.NewMessage(chats=SOURCE_GROUP_ID))
    async def on_new_product(event):
        # Faqat yangi kelgan rasmli postlarni ushlash
        if event.photo:
            try:
                photo_bytes = await event.download_media(file=bytes)

                # Dublikat tekshiruvi
                if dedup.is_duplicate(photo_bytes):
                    return

                caption = event.text or ""
                card_text = await process_catalog_item(photo_bytes, caption)

                if not card_text:
                    return

                photo_stream = io.BytesIO(photo_bytes)
                photo_stream.name = "product.jpg"

                # 167 raqamli Ai created topiciga yuborish
                await client.send_file(
                    entity=TARGET_GROUP_ID,
                    file=photo_stream,
                    caption=card_text,
                    reply_to=int(AI_TOPIC_ID)
                )
                print("⚡ Yangi mahsulot 'Ai created' topiciga joylandi!")

            except Exception as e:
                print(f"Yangi postni ishlashda xatolik: {e}")
