import io
import asyncio
from telethon import events
from telethon.tl.types import InputReplyToMessage
from config import TARGET_GROUP_ID, AI_TOPIC_ID, SOURCE_GROUP_ID
from services.ai_service import process_catalog_item
from services.dedup_service import Deduplicator

dedup = Deduplicator()


def register_command_handler(client):
    @client.on(events.NewMessage(chats=TARGET_GROUP_ID))
    async def handle_topic_search(event):
        # Faqat 167-topicdagi xabarlarni tekshirish
        msg_topic = getattr(event.message, 'reply_to_msg_id', None) or getattr(event.message, 'message_thread_id', None)
        if msg_topic != int(AI_TOPIC_ID) or not event.text:
            return

        query = event.text.strip()
        # Komandalar yoki o'ta qisqa so'zlarni tashlab ketish
        if query.startswith('/') or len(query) < 2:
            return

        status_msg = await event.reply(
            f"🔍 Arxivdan '{query}' bo'yicha mahsulotlar qidirilmoqda...",
            reply_to=int(AI_TOPIC_ID)
        )

        found_count = 0
        async for message in client.iter_messages(SOURCE_GROUP_ID, search=query):
            if message.photo:
                try:
                    photo_bytes = await message.download_media(file=bytes)
                    # Dublikat bo'lsa tashlab o'tish
                    if dedup.is_duplicate(photo_bytes):
                        continue

                    caption = message.text or ""
                    card_text = await process_catalog_item(photo_bytes, caption)

                    if not card_text:
                        continue

                    photo_stream = io.BytesIO(photo_bytes)
                    photo_stream.name = "product.jpg"

                    # 167-topicga chiqarish
                    await client.send_file(
                        entity=TARGET_GROUP_ID,
                        file=photo_stream,
                        caption=card_text,
                        reply_to=int(AI_TOPIC_ID)
                    )
                    found_count += 1
                    await asyncio.sleep(4)  # API limitini himoyalash

                except Exception as err:
                    print(f"Qidiruvda xatolik: {err}")

        await status_msg.edit(f"✅ '{query}' bo'yicha jami {found_count} ta unikal mahsulot topildi va chiqarildi.")
