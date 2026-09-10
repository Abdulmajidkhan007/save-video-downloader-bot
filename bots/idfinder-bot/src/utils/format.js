'use strict';

// Telegram MarkdownV2/HTML o'rniga oddiy matn ishlatamiz (xavfsiz, escape kerak emas).

function line(label, value) {
  if (value === undefined || value === null || value === '') return null;
  return `${label}: ${value}`;
}

const TYPE_LABEL = {
  private: 'Foydalanuvchi',
  group: 'Guruh',
  supergroup: 'Superguruh',
  channel: 'Kanal',
};

// getChat natijasini chiroyli matnga aylantiradi (user yoki chat).
// Ixtiyoriy extra: { member_count } — boyitilgan ma'lumot.
function formatChat(chat, extra = {}) {
  const typeEmoji = {
    private: '👤',
    group: '👥',
    supergroup: '👥',
    channel: '📢',
  };
  const emoji = typeEmoji[chat.type] || '🆔';

  const details = [
    line('🆔 ID', `<code>${chat.id}</code>`),
    line('📂 Tur', TYPE_LABEL[chat.type] || chat.type),
    line('👤 Ism', chat.first_name),
    line('👥 Familiya', chat.last_name),
    line('🏷 Nomi', chat.title),
    line('📛 Username', chat.username ? `@${chat.username}` : null),
    line('👥 A\'zolar', extra.member_count != null ? extra.member_count : null),
    line('👮 Adminlar', extra.admin_count != null ? extra.admin_count : null),
    line(
      '👑 Egasi',
      extra.creator
        ? `${extra.creator}${extra.creator_id ? ` (<code>${extra.creator_id}</code>)` : ''}`
        : null
    ),
    line('📝 Bio', chat.bio),
    line('📝 Tavsif', chat.description),
    line('🔗 Havola', chat.invite_link),
    line('💬 Bog\'langan chat', chat.linked_chat_id ? `<code>${chat.linked_chat_id}</code>` : null),
  ].filter(Boolean);

  return [`${emoji} <b>Topildi</b>`, '', ...details].join('\n');
}

// users_shared / contact dan kelgan oddiy user_id ni formatlaydi.
function formatUserId(userId, extra = {}) {
  const details = [
    line('🆔 ID', `<code>${userId}</code>`),
    line('👤 Ism', extra.first_name),
    line('👥 Familiya', extra.last_name),
    line('📛 Username', extra.username ? `@${extra.username}` : null),
    line('📞 Telefon', extra.phone_number),
  ].filter(Boolean);

  return ['👤 <b>Foydalanuvchi ID</b>', '', ...details].join('\n');
}

module.exports = { formatChat, formatUserId };
