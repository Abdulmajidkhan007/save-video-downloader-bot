import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface SetLimitDto {
  amount: number;
  currency?: string;
  categoryId?: string;
  userId?: string;
  month: number;
  year: number;
  groupId: string;
}

@Injectable()
export class LimitsService {
  constructor(private prisma: PrismaService) {}

  async setLimit(dto: SetLimitDto) {
    return this.prisma.monthlyLimit.upsert({
      where: {
        groupId_userId_categoryId_month_year: {
          groupId: dto.groupId,
          userId: dto.userId || null,
          categoryId: dto.categoryId || null,
          month: dto.month,
          year: dto.year,
        },
      },
      update: { amount: new Prisma.Decimal(dto.amount), currency: dto.currency || 'UZS' },
      create: {
        groupId: dto.groupId,
        userId: dto.userId,
        categoryId: dto.categoryId,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency || 'UZS',
        month: dto.month,
        year: dto.year,
      },
    });
  }

  async getLimitsWithUsage(groupId: string, month: number, year: number) {
    const limits = await this.prisma.monthlyLimit.findMany({
      where: { groupId, month, year, isActive: true },
      include: { category: true, user: true },
    });

    const result = await Promise.all(
      limits.map(async (limit) => {
        const spent = await this.prisma.expense.aggregate({
          where: {
            groupId,
            month,
            year,
            status: 'ACTIVE',
            categoryId: limit.categoryId || undefined,
            userId: limit.userId || undefined,
          },
          _sum: { amount: true },
        });

        const spentAmount = Number(spent._sum.amount || 0);
        const limitAmount = Number(limit.amount);
        const percentage = limitAmount > 0 ? Math.round((spentAmount / limitAmount) * 100) : 0;

        return {
          ...limit,
          spentAmount,
          remaining: Math.max(0, limitAmount - spentAmount),
          percentage,
          isExceeded: spentAmount > limitAmount,
          isWarning: percentage >= 80 && percentage < 100,
        };
      }),
    );

    return result;
  }

  async deleteLimit(id: string) {
    return this.prisma.monthlyLimit.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
