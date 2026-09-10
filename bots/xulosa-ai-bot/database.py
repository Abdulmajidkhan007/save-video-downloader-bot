import sqlite3
from datetime import datetime, timedelta, timezone

DB_NAME = "bot_data.db"

def init_db():
    """Ma'lumotlar bazasini yaratish va jadvallarni sozlash."""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER,
                sender TEXT,
                text TEXT,
                media_type TEXT,
                timestamp DATETIME
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                first_name TEXT,
                sub_until DATETIME,
                daily_requests INTEGER DEFAULT 0,
                last_request_date TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS groups (
                group_id INTEGER PRIMARY KEY,
                title TEXT,
                added_at DATETIME
            )
        """)
        conn.commit()

def save_user(user_id, first_name):
    """Yangi foydalanuvchini bazaga qo'shish (3 kunlik bepul sinov bilan)."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    now = datetime.now(timezone.utc)
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT user_id FROM users WHERE user_id = ?", (user_id,))
        if not cursor.fetchone():
            trial_until = (now + timedelta(days=3)).isoformat()
            cursor.execute("INSERT INTO users VALUES (?, ?, ?, 0, ?)",
                           (user_id, first_name, trial_until, today))
            conn.commit()

def save_group(group_id, title):
    """Guruh ma'lumotlarini saqlash."""
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT OR REPLACE INTO groups VALUES (?, ?, ?)", (group_id, title, now))
        conn.commit()

def save_message(group_id, sender, text, media_type="text"):
    """Guruhdagi xabarni bazaga saqlash."""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute("INSERT INTO messages (group_id, sender, text, media_type, timestamp) VALUES (?, ?, ?, ?, ?)",
                       (group_id, sender, text, media_type, now))
        conn.commit()

def get_history(group_id, days=1):
    """Ma'lum bir guruhdagi belgilangan kun ichidagi xabarlarni olish."""
    time_threshold = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT sender, text FROM messages WHERE group_id = ? AND timestamp >= ? ORDER BY timestamp ASC",
                       (group_id, time_threshold))
        return cursor.fetchall()

def check_user_access(user_id):
    """Foydalanuvchi ruxsati, obunasi va kunlik limitini tekshirish."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    now = datetime.now(timezone.utc)
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT sub_until, daily_requests, last_request_date FROM users WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()

        # Foydalanuvchi bazada bo'lmasa
        if not row:
            return True, "3 kunlik bepul sinov"

        sub_until, daily_requests, last_date = row
        sub_date = datetime.fromisoformat(sub_until) if sub_until else None

        # Obunasi faol bo'lsa
        if sub_date and sub_date > now:
            return True, f"Obuna faol ({sub_until[:10]} gacha)"

        # Obunasi yo'q, lekin bugungi so'rov hali qilinmagan bo'lsa
        if last_date != today:
            cursor.execute("UPDATE users SET daily_requests = 1, last_request_date = ? WHERE user_id = ?", (today, user_id))
            conn.commit()
            return True, "Kunlik limit (1/2)"

        # Bugungi so'rovlar chegaraga yetmagan bo'lsa (kuniga 2 ta)
        elif daily_requests < 2:
            cursor.execute("UPDATE users SET daily_requests = daily_requests + 1 WHERE user_id = ?", (user_id,))
            conn.commit()
            return True, f"Kunlik limit ({daily_requests + 1}/2)"

        # Barcha bepul limitlar tugagan
        else:
            return False, "Limit tugadi. Obuna sotib oling!"

def add_subscription(user_id, days=30):
    """Foydalanuvchiga obuna kunlarini qo'shish."""
    now = datetime.now(timezone.utc)
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT sub_until FROM users WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if row and row[0] and datetime.fromisoformat(row[0]) > now:
            new_date = datetime.fromisoformat(row[0]) + timedelta(days=days)
        else:
            new_date = now + timedelta(days=days)
        cursor.execute("UPDATE users SET sub_until = ? WHERE user_id = ?", (new_date.isoformat(), user_id))
        conn.commit()

def get_stats():
    """Admin panel uchun umumiy statistika."""
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM groups")
        total_groups = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM users WHERE sub_until > ?", (now,))
        active_subs = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM messages")
        total_messages = cursor.fetchone()[0]
        return total_users, total_groups, active_subs, total_messages

def get_all_users_list():
    """So'nggi 10 ta foydalanuvchini ro'yxatini olish."""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT user_id, first_name, sub_until FROM users ORDER BY user_id DESC LIMIT 10")
        return cursor.fetchall()

def get_all_groups_list():
    """So'nggi 10 ta guruhni ro'yxatini olish."""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT group_id, title FROM groups ORDER BY added_at DESC LIMIT 10")
        return cursor.fetchall()

def search_user_by_id(user_id):
    """ID bo'yicha foydalanuvchini qidirish."""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT user_id, first_name, sub_until, daily_requests FROM users WHERE user_id = ?", (user_id,))
        return cursor.fetchone()

def get_recent_logs():
    """So'nggi 5 ta xabarni (log) olish."""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT group_id, sender, text, timestamp FROM messages ORDER BY id DESC LIMIT 5")
        return cursor.fetchall()
