import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Group } from '@prisma/client';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async findUserGroups(userId: string): Promise<Group[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId, isActive: true },
      include: {
        group: {
          include: {
            settings: true,
            _count: { select: { members: true, expenses: true } },
          },
        },
      },
    });

    return memberships.map((m) => m.group as Group);
  }

  async findOne(id: string, userId: string): Promise<Group> {
    const member = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: id } },
    });

    if (!member || !member.isActive) throw new ForbiddenException('Not a member of this group');

    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        settings: true,
        members: { include: { user: true } },
        _count: { select: { expenses: true, members: true } },
      },
    });

    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async updateSettings(
    groupId: string,
    userId: string,
    settings: {
      allowMemberExpenses?: boolean;
      requireApproval?: boolean;
      notifyOnExpense?: boolean;
      monthlyBudget?: number;
      alertThreshold?: number;
      currency?: string;
      timezone?: string;
    },
  ) {
    const member = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });

    if (!member || member.role !== 'ADMIN') {
      throw new ForbiddenException('Only group admins can update settings');
    }

    return this.prisma.groupSettings.upsert({
      where: { groupId },
      update: settings,
      create: { groupId, ...settings },
    });
  }

  async getGroupSummary(groupId: string) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [group, expenseTotal, memberCount, categories] = await Promise.all([
      this.prisma.group.findUnique({
        where: { id: groupId },
        include: { settings: true },
      }),
      this.prisma.expense.aggregate({
        where: { groupId, month, year, status: 'ACTIVE' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.groupMember.count({ where: { groupId, isActive: true } }),
      this.prisma.category.count({ where: { groupId } }),
    ]);

    if (!group) throw new NotFoundException('Group not found');

    return {
      ...group,
      stats: {
        monthlyTotal: Number(expenseTotal._sum.amount || 0),
        expenseCount: expenseTotal._count,
        memberCount,
        categoryCount: categories,
      },
    };
  }
}
