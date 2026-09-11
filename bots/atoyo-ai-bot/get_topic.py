import asyncio
from telethon import TelegramClient
from telethon.tl.functions.channels import GetForumTopicsRequest
from config import API_ID, API_HASH, TARGET_GROUP_ID

client = TelegramClient("atoyo_admin_session", API_ID, API_HASH)


async def main():
    await client.start()
    entity = await client.get_entity(TARGET_GROUP_ID)
    topics = await client(GetForumTopicsRequest(channel=entity, offset_date=None, offset_id=0, offset_topic=0, limit=20))

    print("--- Guruhdagi Topiclar ro'yxati ---")
    for t in topics.topics:
        print(f"Topic nomi: '{t.title}' | ID: {t.id}")


if __name__ == "__main__":
    asyncio.run(main())
