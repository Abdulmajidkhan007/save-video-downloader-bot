import { Telegraf } from 'telegraf';
import { BotContext } from '../types/context';
import { ExpenseService } from '../services/expense.service';
import { logger } from '../utils/logger';

export function registerMessageHandlers(bot: Telegraf<BotContext>, expenseService: ExpenseService): void {
  bot.on('text', async (ctx) => {
    if (!ctx.dbGroup || !ctx.dbUser) return;
    if (ctx.message.text.startsWith('/')) return;

    const text = ctx.message.text.trim();
    if (text.length < 3) return;

    try {
      const result = await expenseService.parseAndCreate({
        rawText: text,
        userId: ctx.dbUser.id,
        groupId: ctx.dbGroup.id,
        telegramMsgId: BigInt(ctx.message.message_id),
      });

      if (result) {
        await ctx.replyWithMarkdownV2(
          result.formatted.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&'),
          { reply_parameters: { message_id: ctx.message.message_id } },
        );
      }
    } catch (error) {
      logger.error('Message handler error:', error);
    }
  });

  // Handle new member joining
  bot.on('new_chat_members', async (ctx) => {
    const botId = ctx.botInfo.id;
    const newMembers = ctx.message.new_chat_members;
    const botJoined = newMembers.some((m) => m.id === botId);

    if (botJoined && ctx.dbGroup) {
      await ctx.replyWithMarkdownV2(
        `👋 *Assalomu alaykum\\!*\n\n` +
        `💰 Men xarajatlarni kuzatib boruvchi botman\\.\n\n` +
        `📋 *Boshlash uchun:*\n` +
        `1\\. Meni guruh admini qiling\n` +
        `2\\. Xarajatlarni yuboring:\n` +
        `   \`500000 so'm ovqatga\`\n` +
        `   \`2 mln remontga\`\n\n` +
        `/help — barcha komandalar`,
      );
    }
  });
}
