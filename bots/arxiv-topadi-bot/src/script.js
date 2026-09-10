'use strict';

// buildScript(): 6-qadamda foydalanuvchiga yuboriladigan recover.py matnini qaytaradi.
//
// recover.py Telethon bilan ishlaydi:
//   - iter_admin_log(source, delete=True) orqali O'CHIRILGAN xabarlarni o'qiydi
//   - ularni yangi guruhga ko'chiradi
//   - MessageService (kirdi/chiqdi kabi) xabarlarni tashlab yuboradi
//   - media eskirgan bo'lsa faqat matnni yuboradi
//   - FloodWaitError da e.seconds kutadi, har xabar orasida 1.5s pauza
//   - api_id/api_hash/manzillar input() orqali so'raladi
//   - telefon/kod/2FA'ni Telethon .start() ning o'zi so'raydi (bot emas!)

function buildScript() {
  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
recover.py — o'chirilgan xabarlarni admin log orqali tiklab, yangi guruhga ko'chiradi.

MUHIM / XAVFSIZLIK:
  * Bu skript FAQAT o'z qurilmangda, o'z akkountingda ishlaydi.
  * Login kodini yoki 2FA parolini hech qanday BOTGA kiritma — ularni
    faqat mana shu skript (Telethon) o'zi so'raydi.
  * Faqat o'zing ADMIN bo'lgan guruhda ishlaydi (admin log shart).
  * api_hash va *.session faylini hech kimga berma.
"""

import time
from telethon import TelegramClient
from telethon.errors import FloodWaitError
from telethon.tl.types import MessageService


def ask(prompt):
    return input(prompt).strip()


def main():
    print("=== O'chgan xabarlarni tiklash ===\\n")

    api_id = int(ask("api_id (raqam): "))
    api_hash = ask("api_hash: ")
    source = ask("Eski (o'chgan xabarli) guruh — @username yoki -100... id: ")
    target = ask("Yangi guruh — @username yoki -100... id: ")

    # Telethon .start() telefon, login kod va (bo'lsa) 2FA parolni O'ZI so'raydi.
    client = TelegramClient("session", api_id, api_hash)
    client.start()

    src = client.get_entity(source)
    dst = client.get_entity(target)

    # Admin log yozuvlarini eng eskisidan boshlab ko'chirish uchun to'plab olamiz.
    events = list(client.iter_admin_log(src, delete=True))
    events.reverse()  # xronologik tartib

    copied = 0
    print(f"\\nTopilgan o'chirilgan yozuvlar: {len(events)}\\n")

    for event in events:
        msg = event.old  # o'chirilgan xabarning o'zi

        # Service xabarlar (kirdi/chiqdi/pin va h.k.) — tashlab yuboramiz.
        if msg is None or isinstance(msg, MessageService):
            continue

        text = msg.message or ""

        while True:
            try:
                if msg.media is not None:
                    # Media hali yashaydigan bo'lsa — media bilan yuboramiz.
                    try:
                        client.send_message(dst, text or "", file=msg.media)
                    except Exception:
                        # Media eskirgan/yaroqsiz — faqat matnni yuboramiz.
                        if text:
                            client.send_message(dst, text)
                        else:
                            break
                else:
                    if not text:
                        break
                    client.send_message(dst, text)

                copied += 1
                print(f"[{copied}] ko'chirildi")
                break

            except FloodWaitError as e:
                print(f"FloodWait: {e.seconds}s kutilmoqda...")
                time.sleep(e.seconds + 1)

        # Har xabar orasida biroz kutamiz — flood bo'lmasin.
        time.sleep(1.5)

    print(f"\\nTayyor. Jami ko'chirildi: {copied}")
    client.disconnect()


if __name__ == "__main__":
    main()
`;
}

module.exports = { buildScript };
