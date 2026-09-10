import { Telegraf } from 'telegraf';
import { BotContext } from '../types/context';
import { ExpenseService } from '../services/expense.service';
import { statsNavKeyboard } from '../keyboards/main.keyboard';

export function registerStatsCommands(bot: Telegraf<BotContext>, expenseService: ExpenseService): void {
  bot.command('today', async (ctx) => {
    if (!ctx.dbGroup) return ctx.reply('Bu komanda faqat guruhda ishlaydi.');
    await ctx.sendChatAction('typing');
    const msg = await expenseService.getTodayStats(ctx.dbGroup.id);
    await ctx.replyWithMarkdownV2(escapeMarkdownV2(msg), statsNavKeyboard('today'));
  });

  bot.command('week', async (ctx) => {
    if (!ctx.dbGroup) return ctx.reply('Bu komanda faqat guruhda ishlaydi.');
    await ctx.sendChatAction('typing');
    const msg = await expenseService.getWeekStats(ctx.dbGroup.id);
    await ctx.replyWithMarkdownV2(escapeMarkdownV2(msg), statsNavKeyboard('week'));
  });

  bot.command('month', async (ctx) => {
    if (!ctx.dbGroup) return ctx.reply('Bu komanda faqat guruhda ishlaydi.');
    await ctx.sendChatAction('typing');
    const msg = await expenseService.getMonthStats(ctx.dbGroup.id);
    await ctx.replyWithMarkdownV2(escapeMarkdownV2(msg), statsNavKeyboard('month'));
  });

  bot.command('top', async (ctx) => {
    if (!ctx.dbGroup) return ctx.reply('Bu komanda faqat guruhda ishlaydi.');
    await ctx.sendChatAction('typing');
    const msg = await expenseService.getTopCategories(ctx.dbGroup.id);
    await ctx.replyWithMarkdownV2(escapeMarkdownV2(msg));
  });

  bot.command('categories', async (ctx) => {
    if (!ctx.dbGroup) return ctx.reply('Bu komanda faqat guruhda ishlaydi.');
    await ctx.sendChatAction('typing');
    const msg = await expenseService.getTopCategories(ctx.dbGroup.id);
    await ctx.replyWithMarkdownV2(escapeMarkdownV2(msg));
  });

  bot.command('stats', async (ctx) => {
    if (!ctx.dbGroup) return ctx.reply('Bu komanda faqat guruhda ishlaydi.');
    await ctx.sendChatAction('typing');
    const [today, month] = await Promise.all([
      expenseService.getTodayStats(ctx.dbGroup.id),
      expenseService.getMonthStats(ctx.dbGroup.id),
    ]);
    await ctx.replyWithMarkdownV2(escapeMarkdownV2(`📊 *Umumiy statistika*\n\n${month}`), statsNavKeyboard('month'));
  });
}

export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
