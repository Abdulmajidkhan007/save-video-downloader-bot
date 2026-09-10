import { Context, MiddlewareFn } from 'telegraf';
import { UserService } from '../services/user.service';
import { BotContext } from '../types/context';
import { logger } from '../utils/logger';

export function groupMiddleware(userService: UserService): MiddlewareFn<BotContext> {
  return async (ctx: BotContext, next) => {
    try {
      const from = ctx.from;
      if (!from) return next();

      // Upsert user
      const user = await userService.upsertUser({
        telegramId: BigInt(from.id),
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
        languageCode: from.language_code,
      });

      ctx.dbUser = user;

      // Handle group context
      if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
        const group = await userService.upsertGroup({
          telegramId: BigInt(ctx.chat.id),
          title: ctx.chat.title || 'Unknown Group',
          type: ctx.chat.type === 'supergroup' ? 'SUPERGROUP' : 'GROUP',
          username: 'username' in ctx.chat ? ctx.chat.username : undefined,
        });

        ctx.dbGroup = group;
        await userService.addMember(user.id, group.id);
        await userService.ensureDefaultCategories(group.id);
      }

      return next();
    } catch (error) {
      logger.error('Group middleware error:', error);
      return next();
    }
  };
}
