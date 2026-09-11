import asyncio
from telethon import TelegramClient
from config import API_ID, API_HASH
from handlers.command_handler import register_command_handler
from handlers.listener import register_listener

client = TelegramClient("atoyo_admin_session", API_ID, API_HASH)


async def main():
    await client.start()
    print("Atoyo Userbot muvaffaqiyatli ishga tushdi va kuzatuvda...")

    # Handlerlarni faollashtirish
    register_command_handler(client)
    register_listener(client)

    await client.run_until_disconnected()


if __name__ == "__main__":
    asyncio.run(main())
