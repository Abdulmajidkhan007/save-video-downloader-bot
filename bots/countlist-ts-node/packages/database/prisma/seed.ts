import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  { name: 'Oziq-ovqat', nameUz: 'Oziq-ovqat', icon: '🍕', color: '#f59e0b' },
  { name: 'Transport', nameUz: 'Transport', icon: '🚗', color: '#3b82f6' },
  { name: 'Uy-joy', nameUz: 'Uy-joy', icon: '🏠', color: '#10b981' },
  { name: 'Kiyim-kechak', nameUz: 'Kiyim-kechak', icon: '👗', color: '#8b5cf6' },
  { name: "Sog'liq", nameUz: "Sog'liq", icon: '💊', color: '#ef4444' },
  { name: "Ta'lim", nameUz: "Ta'lim", icon: '📚', color: '#06b6d4' },
  { name: "Ko'ngilochar", nameUz: "Ko'ngilochar", icon: '🎮', color: '#f97316' },
  { name: 'Texnologiya', nameUz: 'Texnologiya', icon: '💻', color: '#6366f1' },
  { name: 'Sport', nameUz: 'Sport', icon: '⚽', color: '#84cc16' },
  { name: 'Sayohat', nameUz: 'Sayohat', icon: '✈️', color: '#14b8a6' },
  { name: 'Sovg\'a', nameUz: "Sovg'a", icon: '🎁', color: '#ec4899' },
  { name: 'Boshqa', nameUz: 'Boshqa', icon: '📦', color: '#94a3b8' },
];

async function main() {
  console.log('🌱 Seeding default categories...');

  for (const cat of DEFAULT_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { name: cat.name, isDefault: true, groupId: null },
    });

    if (!existing) {
      await prisma.category.create({
        data: { ...cat, isDefault: true, groupId: null },
      });
      console.log(`  ✓ ${cat.icon} ${cat.name}`);
    } else {
      console.log(`  - ${cat.icon} ${cat.name} (already exists)`);
    }
  }

  console.log('✅ Seeding completed');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
