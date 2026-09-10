// ============================================================
//  Umumiy sozlamalar
//  Kanallar va admin ID'lar .env faylidan o'qiladi (yangilanishda saqlanadi).
// ============================================================
require('dotenv').config();

function parseList(s) {
  return (s || '').split(',').map(x => x.trim()).filter(Boolean);
}

module.exports = {
  // .env: REQUIRED_CHANNELS=@kanal1,@kanal2   (bo'sh qoldirsangiz obuna talab qilinmaydi)
  REQUIRED_CHANNELS: parseList(process.env.REQUIRED_CHANNELS),

  // .env: ADMIN_IDS=123456789,987654321   (admin panel uchun)
  ADMIN_IDS: parseList(process.env.ADMIN_IDS).map(Number),

  // Foydalanuvchi tanlay oladigan savol soni
  COUNT_OPTIONS: [5, 10, 20],

  // Har savolga vaqt (soniya)
  TIME_OPTIONS: [10, 15, 30, 60],

  // Barcha yo'nalishlar (admin yangi bo'lim qo'shganda shu ro'yxatdan tanlaydi)
  DIRECTIONS: [
    { key: 'frontend', label: 'Frontend' },
    { key: 'backend', label: 'Backend' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'devops', label: 'DevOps' },
    { key: 'security', label: 'Kiberxavfsizlik' },
    { key: 'general', label: 'Umumiy IT' }
  ],

  // Yo'nalish kodiga emoji
  DIRECTION_EMOJI: {
    frontend: '🎨',
    backend: '⚙️',
    mobile: '📱',
    devops: '🐳',
    security: '🔐',
    general: '💡'
  }
};
