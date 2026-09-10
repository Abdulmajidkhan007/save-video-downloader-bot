import { Telegraf, session } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { logger } from './utils/logger';
import { BotContext } from './types/context';
import { groupMiddleware } from './middlewares/group.middleware';
import { UserService } from './services/user.service';
import { ExpenseService } from './services/expense.service';
import { registerStartCommand } from './commands/start.command';
import { registerHelpCommand } from './commands/help.command';
import { registerStatsCommands } from './commands/stats.command';
import { registerExportCommand } from './commands/export.command';
import { registerCallbackHandlers } from './handlers/callback.handler';
import { registerMessageHandlers } from './handlers/message.handler';

async function bootstrap() {
  const prisma = new PrismaClient();
  await prisma.$connect();
  logger.info('Database connected');

  const bot = new Telegraf<BotContext>(config.bot.token);

  const userService = new UserService(prisma);
  const expenseService = new ExpenseService(prisma);

  // Middlewares
  bot.use(session());
  bot.use(groupMiddleware(userService));

  // Commands
  registerStartCommand(bot);
  registerHelpCommand(bot);
  registerStatsCommands(bot, expenseService);
  registerExportCommand(bot);

  // Handlers
  registerCallbackHandlers(bot, expenseService);
  registerMessageHandlers(bot, expenseService);

  // Error handler
  bot.catch((err, ctx) => {
    logger.error(`Bot error for ${ctx.updateType}:`, err);
  });

  // Launch
  if (config.bot.webhookUrl && config.nodeEnv === 'production') {
    await bot.launch({ webhook: { domain: config.bot.webhookUrl } });
    logger.info(`Bot started with webhook: ${config.bot.webhookUrl}`);
  } else {
    await bot.launch();
    logger.info('Bot started with polling');
  }

  process.once('SIGINT', () => {
    bot.stop('SIGINT');
    prisma.$disconnect();
  });
  process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    prisma.$disconnect();
  });
}

bootstrap().catch((err) => {
  logger.error('Fatal error:', err);
  process.exit(1);
});
