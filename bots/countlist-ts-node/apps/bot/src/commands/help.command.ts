import { Telegraf } from 'telegraf';
import { BotContext } from '../types/context';

export function registerHelpCommand(bot: Telegraf<BotContext>): void {
  bot.command('help', async (ctx) => {
    await ctx.replyWithMarkdownV2(
      `📚 *Yordam — Expense Tracker Bot*\n\n` +
      `*💬 Xarajat qo'shish:*\n` +
      `Shunchaki matn yuboring:\n` +
      `\\• \`500000 so'm ovqatga\`\n` +
      `\\• \`2 mln remontga\`\n` +
      `\\• \`50k taksi\`\n` +
      `\\• \`150000 telefonga\`\n\n` +
      `*📊 Statistika:*\n` +
      `/today — Bugungi xarajatlar\n` +
      `/week — Haftalik statistika\n` +
      `/month — Oylik statistika\n` +
      `/stats — Umumiy statistika\n` +
      `/top — Top kategoriyalar\n\n` +
      `*⚙️ Boshqaruv:*\n` +
      `/categories — Kategoriyalar ro'yxati\n` +
      `/limit — Oylik limitni ko'rish/o'rnatish\n` +
      `/balance — Balans va chegara\n` +
      `/export — Ma'lumotlarni eksport qilish\n` +
      `/settings — Bot sozlamalari\n\n` +
      `*ℹ️ Eslatma:*\n` +
      `Bot guruh admini bo'lishi kerak\\!`,
    );
  });
}
