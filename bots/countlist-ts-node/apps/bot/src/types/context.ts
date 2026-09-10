import { Context } from 'telegraf';
import { User, Group } from '@prisma/client';

export interface BotContext extends Context {
  dbUser?: User;
  dbGroup?: Group;
}
