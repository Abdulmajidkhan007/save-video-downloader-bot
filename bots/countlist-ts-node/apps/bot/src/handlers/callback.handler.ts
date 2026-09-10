import { Telegraf } from 'telegraf';
import { BotContext } from '../types/context';
import { ExpenseService } from '../services/expense.service';
import { statsNavKeyboard, mainInlineKeyboard, exportKeyboard } from '../keyboards/main.keyboard';
import { escapeMarkdownV2 } from '../commands/stats.command';
import { logger } from '../utils/logger';

export function registerCallbackHandlers(bot: Telegraf<BotContext>, expenseService: ExpenseService): void {
  bot.action('stats:today', async (ctx) => {
    if (!ctx.dbGroup) return;
    await ctx.answerCbQuery();
    await ctx.sendChatAction('typing');
    const msg = await expenseService.getTodayStats(ctx.dbGroup.id);
    await ctx.editMessageText(escapeMarkdownV2(msg), {
      parse_mode: 'MarkdownV2',
      ...statsNavKeyboard('today'),
    });
  });

  bot.action('stats:week', async (ctx) => {
    if (!ctx.dbGroup) return;
    await ctx.answerCbQuery();
    await ctx.sendChatAction('typing');
    const msg = await expenseService.getWeekStats(ctx.dbGroup.id);
    await ctx.editMessageText(escapeMarkdownV2(msg), {
      parse_mode: 'MarkdownV2',
      ...statsNavKeyboard('week'),
    });
  });

  bot.action('stats:month', async (ctx) => {
    if (!ctx.dbGroup) return;
    await ctx.answerCbQuery();
    await ctx.sendChatAction('typing');
    const msg = await expenseService.getMonthStats(ctx.dbGroup.id);
    await ctx.editMessageText(escapeMarkdownV2(msg), {
      parse_mode: 'MarkdownV2',
      ...statsNavKeyboard('month'),
    });
  });

  bot.action('stats:categories', async (ctx) => {
    if (!ctx.dbGroup) return;
    await ctx.answerCbQuery();
    const msg = await expenseService.getTopCategories(ctx.dbGroup.id);
    await ctx.editMessageText(escapeMarkdownV2(msg), {
      parse_mode: 'MarkdownV2',
      ...mainInlineKeyboard(),
    });
  });

  bot.action('stats:top', async (ctx) => {
    if (!ctx.dbGroup) return;
    await ctx.answerCbQuery();
    const msg = await expenseService.getTopCategories(ctx.dbGroup.id);
    await ctx.editMessageText(escapeMarkdownV2(msg), {
      parse_mode: 'MarkdownV2',
      ...mainInlineKeyboard(),
    });
  });

  bot.action('export:menu', async (ctx) => {
    if (!ctx.dbGroup) return;
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      escapeMarkdownV2(`📤 *Export — Ma'lumotlarni yuklash*\n\nQaysi formatda yuklamoqchisiz?`),
      { parse_mode: 'MarkdownV2', ...exportKeyboard(ctx.dbGroup.id) },
    );
  });

  bot.action(/^export:(pdf|csv|excel):(.+)$/, async (ctx) => {
    const match = ctx.match;
    const format = match[1].toUpperCase();
    await ctx.answerCbQuery(`⏳ ${format} tayyorlanmoqda...`);
    await ctx.reply(
      `⏳ ${format} fayli tayyorlanmoqda...\n\nBu bir necha soniya vaqt olishi mumkin.`,
    );
    // Export queue - API service handles this
    logger.info(`Export requested: ${format} for group`);
  });

  bot.action('back:main', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      escapeMarkdownV2(`🏠 *Bosh Menyu*\n\nQuyidagi tugmalardan foydalaning:`),
      { parse_mode: 'MarkdownV2', ...mainInlineKeyboard() },
    );
  });

  bot.action('cancel', async (ctx) => {
    await ctx.answerCbQuery('Bekor qilindi');
    await ctx.deleteMessage().catch(() => {});
  });

  bot.action('settings:menu', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      escapeMarkdownV2(`⚙️ *Sozlamalar*\n\nTo'liq sozlamalar uchun veb-dashboardga kiring:\n${process.env.API_URL?.replace('/api', '') || 'http://localhost:3000'}`),
      { parse_mode: 'MarkdownV2', ...mainInlineKeyboard() },
    );
  });
}
