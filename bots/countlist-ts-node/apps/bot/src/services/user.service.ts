import { PrismaClient, User, Group, GroupMember } from '@prisma/client';
import { logger } from '../utils/logger';

export class UserService {
  constructor(private prisma: PrismaClient) {}

  async upsertUser(params: {
    telegramId: bigint;
    username?: string;
    firstName: string;
    lastName?: string;
    languageCode?: string;
  }): Promise<User> {
    return this.prisma.user.upsert({
      where: { telegramId: params.telegramId },
      update: {
        username: params.username,
        firstName: params.firstName,
        lastName: params.lastName,
        languageCode: params.languageCode || 'uz',
      },
      create: {
        telegramId: params.telegramId,
        username: params.username,
        firstName: params.firstName,
        lastName: params.lastName,
        languageCode: params.languageCode || 'uz',
      },
    });
  }

  async upsertGroup(params: {
    telegramId: bigint;
    title: string;
    type: 'GROUP' | 'SUPERGROUP' | 'CHANNEL';
    username?: string;
  }): Promise<Group> {
    const group = await this.prisma.group.upsert({
      where: { telegramId: params.telegramId },
      update: {
        title: params.title,
        username: params.username,
      },
      create: {
        telegramId: params.telegramId,
        title: params.title,
        type: params.type,
        username: params.username,
      },
      include: { settings: true },
    });

    if (!(group as Group & { settings: unknown }).settings) {
      await this.prisma.groupSettings.create({ data: { groupId: group.id } });
    }

    return group;
  }

  async addMember(userId: string, groupId: string, role: 'ADMIN' | 'MEMBER' = 'MEMBER'): Promise<GroupMember> {
    return this.prisma.groupMember.upsert({
      where: { userId_groupId: { userId, groupId } },
      update: { role, isActive: true },
      create: { userId, groupId, role },
    });
  }

  async getGroupByTelegramId(telegramId: bigint): Promise<Group | null> {
    return this.prisma.group.findUnique({
      where: { telegramId },
      include: { settings: true },
    });
  }

  async getUserByTelegramId(telegramId: bigint): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { telegramId } });
  }

  async isGroupAdmin(userId: string, groupId: string): Promise<boolean> {
    const member = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    return member?.role === 'ADMIN';
  }

  async getGroupMembers(groupId: string) {
    return this.prisma.groupMember.findMany({
      where: { groupId, isActive: true },
      include: { user: true },
    });
  }

  async ensureDefaultCategories(groupId: string): Promise<void> {
    const existing = await this.prisma.category.count({ where: { groupId } });
    if (existing > 0) return;

    const defaults = [
      { name: 'Oziq-ovqat', nameUz: 'Oziq-ovqat', icon: '🍕', color: '#f59e0b' },
      { name: 'Transport', nameUz: 'Transport', icon: '🚗', color: '#3b82f6' },
      { name: 'Uy-joy', nameUz: 'Uy-joy', icon: '🏠', color: '#10b981' },
      { name: 'Kiyim-kechak', nameUz: 'Kiyim-kechak', icon: '👗', color: '#8b5cf6' },
      { name: 'Sog\'liq', nameUz: 'Sog\'liq', icon: '💊', color: '#ef4444' },
      { name: 'Ta\'lim', nameUz: 'Ta\'lim', icon: '📚', color: '#06b6d4' },
      { name: 'Ko\'ngilochar', nameUz: 'Ko\'ngilochar', icon: '🎮', color: '#f97316' },
      { name: 'Texnologiya', nameUz: 'Texnologiya', icon: '💻', color: '#6366f1' },
      { name: 'Sport', nameUz: 'Sport', icon: '⚽', color: '#84cc16' },
      { name: 'Boshqa', nameUz: 'Boshqa', icon: '📦', color: '#94a3b8' },
    ];

    await this.prisma.category.createMany({
      data: defaults.map((d) => ({ ...d, groupId })),
      skipDuplicates: true,
    });

    logger.info(`Default categories created for group ${groupId}`);
  }
}
