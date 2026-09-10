import { Telegraf } from 'telegraf';
import { BotContext } from '../types/context';
import { mainInlineKeyboard } from '../keyboards/main.keyboard';

export function registerStartCommand(bot: Telegraf<BotContext>): void {
  bot.start(async (ctx) => {
    const firstName = ctx.from?.first_name || 'Do\'stim';
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

    if (!isGroup) {
      await ctx.replyWithMarkdownV2(
        `👋 *Assalomu alaykum, ${escapeMarkdown(firstName)}\\!*\n\n` +
        `💰 Men *Expense Tracker Bot* \\- guruhdagi xarajatlaringizni kuzatib boraman\\.\n\n` +
        `📋 *Qanday ishlatish:*\n` +
        `1\\. Meni guruhingizga qo'shing\n` +
        `2\\. Meni guruh admini qiling\n` +
        `3\\. Xarajatlarni natural matnda yuboring:\n` +
        `   \\• \`500000 so'm ovqatga\`\n` +
        `   \\• \`2 mln remontga\`\n` +
        `   \\• \`50k taksi\`\n\n` +
        `📊 *Komandalar:*\n` +
        `/today \\- Bugungi xarajatlar\n` +
        `/week \\- Haftalik statistika\n` +
        `/month \\- Oylik statistika\n` +
        `/stats \\- Umumiy statistika\n` +
        `/categories \\- Kategoriyalar\n` +
        `/limit \\- Limitlar\n` +
        `/export \\- Eksport\n` +
        `/help \\- Yordam`,
        mainInlineKeyboard(),
      );
    } else {
      await ctx.replyWithMarkdownV2(
        `👋 *Assalomu alaykum\\!*\n\n` +
        `✅ Men bu guruhda xarajatlarni kuzatib boraman\\.\n\n` +
        `💡 *Xarajat qo'shish uchun:*\n` +
        `\`500000 so'm ovqatga\`\n` +
        `\`2 mln remontga\`\n` +
        `\`50k taksi\`\n\n` +
        `📊 Statistika uchun quyidagi tugmalardan foydalaning:`,
        mainInlineKeyboard(),
      );
    }
  });
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
