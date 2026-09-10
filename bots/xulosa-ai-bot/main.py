import os
import re
import sys
import asyncio
from datetime import datetime, timedelta, timezone

from telethon import TelegramClient, events, Button
from telethon.sessions import StringSession
from telethon.tl.functions.channels import GetParticipantRequest
from telethon.errors import UserNotParticipantError

from google import genai

import config
import database

# Baza initsializatsiyasi va media papka yaratish
database.init_db()
os.makedirs("temp_media", exist_ok=True)

# Gemini AI ulanishi
ai_client = genai.Client(api_key=config.GEMINI_API_KEY)

# Holatlar
admin_state = {}
auto_broadcast_status = False


# ----------------- 4 XIL AUTH TIZIMI -----------------
async def init_telethon_client():
    print("=" * 50)
    print("   TELEGRAM BOT & USERBOT ULASH USULINI TANLANG   ")
    print("=" * 50)
    print("1. QR-kod orqali kirish (UserBot / Shaxsiy profil)")
    print("2. Telefon raqam va SMS orqali kirish (UserBot)")
    print("3. String Session orqali kirish (UserBot)")
    print("4. Bot Token orqali kirish (Rasmiy Telegram Bot)")
    print("=" * 50)

    # Sukut bo'yicha 4 (Bot) tanlanadi, kiritmasa xatolik bermaydi
    choice = input("Tanlovingizni kiriting (1/2/3/4) [standart: 4]: ").strip() or "4"

    if choice == "1":
        client = TelegramClient("user_session", config.API_ID, config.API_HASH)
        await client.connect()
        if not await client.is_user_authorized():
            qr = await client.qr_login()
            print("\n📸 Telegram -> Settings -> Devices -> Link Desktop Device orqali skanerlang:")
            qr.url_print()
            await qr.wait()
        return client, "userbot"

    elif choice == "2":
        client = TelegramClient("user_session", config.API_ID, config.API_HASH)
        await client.start()
        return client, "userbot"

    elif choice == "3":
        if not config.STRING_SESSION:
            print("❌ config.py da (yoki .env da) STRING_SESSION bo'sh!")
            sys.exit(1)
        client = TelegramClient(StringSession(config.STRING_SESSION), config.API_ID, config.API_HASH)
        await client.start()
        return client, "userbot"

    else:
        client = TelegramClient("bot_session", config.API_ID, config.API_HASH)
        await client.start(bot_token=config.BOT_TOKEN)
        return client, "bot"


def get_sender_display_name(sender):
    if not sender:
        return "Anonim"
    if hasattr(sender, "first_name") and sender.first_name:
        return sender.first_name
    if hasattr(sender, "title") and sender.title:
        return sender.title
    return "Foydalanuvchi"


def summarize_with_ai(messages_text, prompt_type="general"):
    """Gemini yordamida matnni xulosalash."""
    if not messages_text.strip():
        return "Tahlil qilish uchun matn topilmadi."

    if prompt_type == "single_post":
        prompt = (
            "Quyidagi xabar/post mazmunini tahlil qilib, uning eng asosiy ma'nosi, "
            "muhim nuqtalari va xulosasini o'zbek tilida chiroyli qilib yoritib ber:\n\n" + messages_text
        )
    else:
        prompt = (
            "Quyidagi suhbatlar/kanal postlari tarixidan eng muhim yangiliklar, e'lonlar va asosiy mavzularni "
            "o'zbek tilida qisqa punktlar shaklida umumlashtirib ber:\n\n" + messages_text
        )

    try:
        res = ai_client.models.generate_content(
            model="gemini-1.5-flash",  # gemini-3.7-flash hali stabil SDK da yo'q bo'lishi mumkin, shuning uchun stabil versiyadan foydalandik
            contents=prompt
        )
        return res.text
    except Exception as e:
        print(f"[Xulosalash xatosi]: {e}")
        return "Xulosa shakllantirishda xatolik yuz berdi."


async def transcribe_media_with_ai(file_path):
    """Gemini yordamida audio/videodan transkripsiya qilish."""
    try:
        uploaded_file = ai_client.files.upload(file=file_path)
        prompt = "Ushbu audio/video xabarda aytilgan gaplarni to'liq o'zbek tilida matn (transkripsiya) ko'rinishida yozib ber."
        res = ai_client.models.generate_content(
            model="gemini-1.5-flash",
            contents=[uploaded_file, prompt]
        )
        return res.text.strip()
    except Exception as e:
        print(f"[Transkripsiya xatosi]: {e}")
        return "[Ovozli/Video xabar aniqlanmadi]"
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


async def parse_and_fetch_link(client, link_text):
    """Telegram havolasidan xabarlarni ajratib olish."""
    # Yopiq guruh/kanal havolasi: t.me/c/chat_id/msg_id
    private_match = re.search(r"t\.me/c/(\d+)/(\d+)", link_text)
    if private_match:
        raw_chat_id = int(private_match.group(1))
        msg_id = int(private_match.group(2))
        full_chat_id = int(f"-100{raw_chat_id}")

        # UserBot bo'lsa postni to'g'ridan to'g'ri ola olamiz
        try:
            entity = await client.get_input_entity(full_chat_id)
            msg = await client.get_messages(entity, ids=msg_id)
            if msg and msg.text:
                return msg.text, "single_post"
        except Exception:
            pass

        # Agar ololmasa bazadagisini izlaymiz
        rows = database.get_history(full_chat_id, days=7)
        if rows:
            return "\n".join([f"{r[0]}: {r[1]}" for r in rows if r[1]]), "general"
        return None, "private_error"

    # Ochiq xabar havolasi: t.me/channel_name/msg_id
    public_post_match = re.search(r"t\.me/([a-zA-Z0-9_]+)/(\d+)", link_text)
    if public_post_match:
        channel_name = public_post_match.group(1)
        msg_id = int(public_post_match.group(2))
        try:
            msg = await client.get_messages(channel_name, ids=msg_id)
            if msg and msg.text:
                return msg.text, "single_post"
        except Exception as e:
            return None, str(e)

    # Kanal havolasi (oxirgi 15ta postni olish): t.me/channel_name
    channel_match = re.search(r"(?:https?://)?(?:t\.me/|@)([a-zA-Z0-9_]+)/?$", link_text)
    if channel_match:
        channel_name = channel_match.group(1)
        try:
            posts = []
            async for m in client.iter_messages(channel_name, limit=15):
                if m.text:
                    posts.append(m.text)
            if posts:
                return "\n---\n".join(posts), "general"
        except Exception as e:
            return None, str(e)

    return None, "invalid"


def get_admin_panel_buttons():
    """Admin panel tugmalari (Inline)."""
    auto_icon = "✅ Yoqiq" if auto_broadcast_status else "❌ O'chiq"
    return [
        [Button.inline("📊 Statistika", data="adm_stats"), Button.inline("📢 Broadcast", data="adm_broadcast")],
        [Button.inline("📣 Kanallar", data="adm_channels"), Button.inline("👥 Foydalanuvchilar", data="adm_users")],
        [Button.inline("👥 Guruhlar", data="adm_groups"), Button.inline("👤 User qidirish", data="adm_search_user")],
        [Button.inline("🚦 Limitlar", data="adm_limits"), Button.inline("🧾 Loglar", data="adm_logs")],
        [Button.inline("🏆 Referral reyting", data="adm_referral")],
        [Button.inline(f"📡 Avto-tarqatish: {auto_icon}", data="adm_toggle_auto")]
    ]


async def register_handlers(client, client_type):
    async def check_channel_subscription(user_id):
        if client_type == "userbot" or not config.REQUIRED_CHANNEL or config.REQUIRED_CHANNEL == "@kanal_username":
            return True
        try:
            await client(GetParticipantRequest(channel=config.REQUIRED_CHANNEL, user_id=user_id))
            return True
        except UserNotParticipantError:
            return False
        except Exception:
            return True

    async def notify_admin(action_text):
        if not config.ADMIN_ID:
            return
        try:
            await client.send_message(config.ADMIN_ID, f"🔔 Bot Harakati:\n{action_text}")
        except Exception:
            pass

    @client.on(events.NewMessage)
    async def main_handler(event):
        global admin_state, auto_broadcast_status
        sender = await event.get_sender()
        user_id = event.sender_id
        text = event.raw_text.strip() if event.raw_text else ""
        sender_name = get_sender_display_name(sender)

        if event.is_private and text == "/id":
            await event.reply(f"Sizning Telegram IDingiz: {user_id}")
            return

        # 1. Telegram Havolalari Tahlili
        if ("t.me/" in text or text.startswith("@")) and not text.startswith("/"):
            allowed, reason = database.check_user_access(user_id)
            if not allowed:
                await event.reply(f"❌ {reason}\nObuna sotib oling.")
                return

            is_subbed = await check_channel_subscription(user_id)
            if not is_subbed:
                await event.reply(f"⚠️ Kanalga a'zo bo'ling: {config.REQUIRED_CHANNEL}")
                return

            status_msg = await event.reply("🔎 Havola tekshirilmoqda va tahlil qilinmoqda...")
            content, p_type = await parse_and_fetch_link(client, text)

            if content:
                summary = summarize_with_ai(content, prompt_type=p_type)
                await status_msg.edit(f"📋 Havola / Kanal tahlili:\n\n{summary}")
                await notify_admin(f"🔗 Havola: [{sender_name}](tg://user?id={user_id}) -> {text}")
            else:
                if p_type == "private_error":
                    await status_msg.edit("⚠️ Yopiq guruh xabarini o'qish uchun u yerda bot a'zo/admin bo'lishi shart.")
                else:
                    await status_msg.edit("❌ Havoladan xabar yuklab bo'lmadi yoki havola xato.")
            return

        # 2. Admin Panel (/admin buyrug'i)
        if event.is_private and user_id == config.ADMIN_ID and text == "/admin":
            await event.reply("🛠 Admin panel", buttons=get_admin_panel_buttons())
            return

        if event.is_private and user_id == config.ADMIN_ID and admin_state.get(user_id) == "waiting_broadcast":
            admin_state[user_id] = None
            users = [u[0] for u in database.get_all_users_list()]
            sent_count = 0
            await event.reply("⏳ Xabar tarqatilmoqda...")
            for uid in users:
                try:
                    await client.send_message(uid, text)
                    sent_count += 1
                    await asyncio.sleep(0.05)
                except Exception:
                    pass
            await event.reply(f"✅ Xabar {sent_count} ta foydalanuvchiga yetkazildi!")
            return

        if event.is_private and user_id == config.ADMIN_ID and admin_state.get(user_id) == "waiting_user_search":
            admin_state[user_id] = None
            try:
                target_uid = int(text)
                u = database.search_user_by_id(target_uid)
                msg = f"👤 Ma'lumot:\n\nID: {u[0]}\nIsm: {u[1]}\nObuna: {u[2]}\nBugungi: {u[3]}/2" if u else "❌ Foydalanuvchi topilmadi."
            except ValueError:
                msg = "❌ Faqat raqamli ID kiriting!"
            await event.reply(msg, buttons=[[Button.inline("⬅️ Orqaga", data="adm_back")]])
            return

        # 3. /start buyrug'i
        if event.is_private and text == "/start":
            database.save_user(user_id, sender_name)
            await notify_admin(f"👤 Start: [{sender_name}](tg://user?id={user_id}) ({user_id})")

            is_subbed = await check_channel_subscription(user_id)
            if not is_subbed:
                btn = [[Button.url("Kanalga a'zo bo'lish", f"https://t.me/{config.REQUIRED_CHANNEL.replace('@', '')}")]]
                await event.reply(f"⚠️ Kanalimizga a'zo bo'ling: {config.REQUIRED_CHANNEL}", buttons=btn)
                return

            await event.reply(
                f"Assalomu alaykum, {sender_name}!\n\n"
                f"📊 Hisobot olish usullari:\n"
                f"1. Guruh ID bo'yicha: /hisobot <guruh_id> <kunlar>\n"
                f"2. Kanal / Post havolasi bo'yicha: Shunchaki linkni yuboring (masalan: https://t.me/...)\n\n"
                f"💳 Obuna narxi: {config.SUB_PRICE}\n"
                f"💳 Karta: {config.CARD_NUMBER}\n"
                f"Chek rasmini yuborsangiz obunangiz faollashadi."
            )
            return

        # 4. Chek qabul qilish (Foto yuborilsa)
        if event.is_private and event.photo:
            await event.reply("Chekingiz adminga yuborildi. Tasdiqlanishini kuting...")
            buttons = [
                [Button.inline("Tasdiqlash (30 kun)", data=f"approve_{user_id}"),
                 Button.inline("Bekor qilish", data=f"reject_{user_id}")]
            ]
            if config.ADMIN_ID:
                await client.send_message(
                    config.ADMIN_ID,
                    f"🧾 Yangi to'lov cheki!\nFoydalanuvchi: [{sender_name}](tg://user?id={user_id}) ({user_id})",
                    file=event.photo,
                    buttons=buttons
                )
            return

        # 5. Hisobot buyrug'i
        if text.startswith("/hisobot"):
            is_subbed = await check_channel_subscription(user_id)
            if not is_subbed:
                await event.reply(f"⚠️ Kanalga a'zo bo'ling: {config.REQUIRED_CHANNEL}")
                return

            allowed, reason = database.check_user_access(user_id)
            if not allowed:
                await event.reply(f"❌ {reason}\nObuna olish uchun chek yuboring.")
                return

            parts = text.split()
            if len(parts) >= 2:
                try:
                    target_id = int(parts[1])
                    days = int(parts[2]) if len(parts) > 2 else 1
                    await event.reply(f"⏳ {days} kunlik ma'lumotlar tahlil qilinmoqda ({reason})...")

                    raw_chat_list = []

                    # UserBot bo'lsa serverdan eski xabarlarni to'liq tortib olish imkoniyati
                    if client_type == "userbot":
                        try:
                            time_threshold = datetime.now(timezone.utc) - timedelta(days=days)
                            async for m in client.iter_messages(target_id, limit=300):
                                if m.date < time_threshold:
                                    break
                                if m.text:
                                    raw_chat_list.append(f"{get_sender_display_name(m.sender)}: {m.text}")
                        except Exception:
                            pass

                    # Bot bo'lsa faqat o'z bazamizdan
                    if not raw_chat_list:
                        rows = database.get_history(target_id, days=days)
                        raw_chat_list = [f"{r[0]}: {r[1]}" for r in rows if r[1]]

                    if not raw_chat_list:
                        await event.reply("⚠️ Baza bo'sh! Yangi xabarlar yozilgach hisobot shakllanadi.")
                        return

                    raw_chat = "\n".join(raw_chat_list)
                    summary = summarize_with_ai(raw_chat, prompt_type="general")
                    await event.reply(f"📊 Guruh hisoboti:\n\n{summary}")
                    await notify_admin(f"📑 Hisobot: [{sender_name}](tg://user?id={user_id}) -> {target_id} ({days} kunlik)")

                except Exception as e:
                    await event.reply(f"❌ Xatolik yuz berdi: {e}")
            else:
                await event.reply("Format: /hisobot <guruh_id> <kunlar>")

        # 6. Guruh xabarlarini saqlash
        elif not event.is_private:
            final_content = text
            media_type = "text"
            if event.voice or event.video_note:
                media_type = "voice" if event.voice else "video_note"
                file_name = f"temp_media/{event.id}.ogg" if event.voice else f"temp_media/{event.id}.mp4"
                await event.download_media(file_name)
                transcribed_text = await transcribe_media_with_ai(file_name)
                final_content = f"[{media_type.upper()}: {transcribed_text}]"

            if final_content:
                database.save_message(event.chat_id, sender_name, final_content, media_type)

    @client.on(events.CallbackQuery)
    async def callback_handler(event):
        global auto_broadcast_status, admin_state
        data = event.data.decode('utf-8')
        user_id = event.sender_id

        # 1. Admin tomonidan chekni tasdiqlash/rad etish
        if data.startswith("approve_"):
            uid = int(data.split("_")[1])
            database.add_subscription(uid, 30)
            await event.edit(f"✅ Foydalanuvchi {uid} obunasi 30 kunga tasdiqlandi!")
            try:
                await client.send_message(uid, "✅ To'lovingiz tasdiqlandi! 30 kunlik obuna berildi.")
            except Exception:
                pass
            return

        elif data.startswith("reject_"):
            uid = int(data.split("_")[1])
            await event.edit(f"❌ Foydalanuvchi {uid} cheki rad etildi.")
            try:
                await client.send_message(uid, "❌ Yuborgan chekingiz rad etildi.")
            except Exception:
                pass
            return

        # Qolganlari faqat admin uchun
        if user_id != config.ADMIN_ID:
            await event.answer("Siz admin emassiz!", alert=True)
            return

        # 2. Admin Panel tugmalari mantiqi
        if data == "adm_stats":
            u, g, s, m = database.get_stats()
            text = f"📊 Statistika:\n\n👥 Foydalanuvchilar: {u} ta\n👥 Guruhlar: {g} ta\n⭐ Faol obunachilar: {s} ta\n💬 Jami xabarlar: {m} ta"
            await event.edit(text, buttons=[[Button.inline("⬅️ Orqaga", data="adm_back")]])

        elif data == "adm_users":
            users = database.get_all_users_list()
            text = "👥 Foydalanuvchilar (So'nggi 10 ta):\n\n" + "\n".join([f"• {u[0]} - {u[1]} ({str(u[2])[:10]})" for u in users]) if users else "Bo'sh."
            await event.edit(text, buttons=[[Button.inline("⬅️ Orqaga", data="adm_back")]])

        elif data == "adm_groups":
            groups = database.get_all_groups_list()
            text = "👥 Guruhlar (So'nggi 10 ta):\n\n" + "\n".join([f"• {g[0]} - {g[1]}" for g in groups]) if groups else "Bo'sh."
            await event.edit(text, buttons=[[Button.inline("⬅️ Orqaga", data="adm_back")]])

        elif data == "adm_search_user":
            admin_state[user_id] = "waiting_user_search"
            await event.edit("👤 Foydalanuvchi ID raqamini yozing:", buttons=[[Button.inline("❌ Bekor qilish", data="adm_back")]])

        elif data == "adm_broadcast":
            admin_state[user_id] = "waiting_broadcast"
            await event.edit("📢 Tarqatmoqchi bo'lgan xabaringizni yozing:", buttons=[[Button.inline("❌ Bekor qilish", data="adm_back")]])

        elif data == "adm_logs":
            logs = database.get_recent_logs()
            text = "🧾 So'nggi loglar:\n\n" + "\n".join([f"• [{l[3][:16]}] {l[1]}: {l[2][:20]}..." for l in logs]) if logs else "Bo'sh."
            await event.edit(text, buttons=[[Button.inline("⬅️ Orqaga", data="adm_back")]])

        elif data == "adm_referral":
            await event.edit("🏆 Referral tizimi faol.", buttons=[[Button.inline("⬅️ Orqaga", data="adm_back")]])

        elif data == "adm_limits":
            await event.edit(f"🚦 Limitlar:\n- Sinov: 3 kun\n- Kunlik: 2 ta hisobot\n- Obuna: {config.SUB_PRICE}", buttons=[[Button.inline("⬅️ Orqaga", data="adm_back")]])

        elif data == "adm_channels":
            await event.edit(f"📣 Majburiy kanal:\n{config.REQUIRED_CHANNEL}", buttons=[[Button.inline("⬅️ Orqaga", data="adm_back")]])

        elif data == "adm_toggle_auto":
            auto_broadcast_status = not auto_broadcast_status
            await event.edit("🛠 Admin panel", buttons=get_admin_panel_buttons())

        elif data == "adm_back":
            admin_state[user_id] = None
            await event.edit("🛠 Admin panel", buttons=get_admin_panel_buttons())

    @client.on(events.ChatAction)
    async def chat_action_handler(event):
        """Bot guruhga qo'shilganda bazaga saqlash."""
        if event.user_added:
            chat = await event.get_chat()
            database.save_group(event.chat_id, getattr(chat, 'title', 'Guruh'))
            await notify_admin(f"👥 Bot guruhga qo'shildi!\nGuruh: {getattr(chat, 'title', 'Guruh')}\nID: {event.chat_id}")


async def main():
    try:
        client, client_type = await init_telethon_client()
        await register_handlers(client, client_type)
        print(f"\n🚀 Bot muvaffaqiyatli ishga tushdi! (Rejim: {client_type.upper()})\n")
        await client.run_until_disconnected()
    except KeyboardInterrupt:
        print("\nBot to'xtatildi.")
    except Exception as e:
        print(f"\nKutilmagan xatolik yuz berdi: {e}")

if __name__ == "__main__":
    asyncio.run(main())
