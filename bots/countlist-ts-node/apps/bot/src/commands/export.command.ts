import { Telegraf } from 'telegraf';
import { BotContext } from '../types/context';
import { exportKeyboard } from '../keyboards/main.keyboard';

export function registerExportCommand(bot: Telegraf<BotContext>): void {
  bot.command('export', async (ctx) => {
    if (!ctx.dbGroup) return ctx.reply('Bu komanda faqat guruhda ishlaydi.');

    await ctx.replyWithMarkdownV2(
      `📤 *Export — Ma'lumotlarni yuklash*\n\n` +
      `Qaysi formatda yuklamoqchisiz?`,
      exportKeyboard(ctx.dbGroup.id),
    );
  });
}
