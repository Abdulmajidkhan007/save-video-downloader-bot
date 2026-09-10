import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsData, TimeSeriesPoint, CategoryBreakdown, UserBreakdown } from '@expense-tracker/shared';
import { startOfDay, endOfDay, eachDayOfInterval, format, startOfWeek, endOfWeek, eachWeekOfInterval, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getFullAnalytics(groupId: string, startDate: Date, endDate: Date): Promise<AnalyticsData> {
    const [daily, weekly, monthly, byCategory, byUser] = await Promise.all([
      this.getDailyData(groupId, startDate, endDate),
      this.getWeeklyData(groupId, startDate, endDate),
      this.getMonthlyData(groupId, subMonths(endDate, 11), endDate),
      this.getCategoryData(groupId, startDate, endDate),
      this.getUserData(groupId, startDate, endDate),
    ]);

    return { daily, weekly, monthly, byCategory, byUser };
  }

  async getDashboardStats(groupId: string) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const [current, previous, todayTotal] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { groupId, month, year, status: 'ACTIVE' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { groupId, month: prevMonth, year: prevYear, status: 'ACTIVE' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: {
          groupId,
          date: { gte: startOfDay(now), lte: endOfDay(now) },
          status: 'ACTIVE',
        },
        _sum: { amount: true },
      }),
    ]);

    const currentAmt = Number(current._sum.amount || 0);
    const prevAmt = Number(previous._sum.amount || 0);
    const change = prevAmt > 0 ? ((currentAmt - prevAmt) / prevAmt) * 100 : 0;

    const daysInMonth = new Date(year, month, 0).getDate();
    const daysPassed = now.getDate();

    const topCat = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      where: { groupId, month, year, status: 'ACTIVE' },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 1,
    });

    let topCategoryName: string | null = null;
    if (topCat[0]?.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: topCat[0].categoryId } });
      topCategoryName = cat ? `${cat.icon} ${cat.name}` : null;
    }

    return {
      totalExpenses: current._count,
      totalAmount: currentAmt,
      currency: 'UZS',
      avgPerDay: daysPassed > 0 ? currentAmt / daysPassed : 0,
      projectedMonthly: (currentAmt / daysPassed) * daysInMonth,
      todayAmount: Number(todayTotal._sum.amount || 0),
      topCategory: topCategoryName,
      monthlyChange: Math.round(change * 10) / 10,
      previousMonthAmount: prevAmt,
    };
  }

  private async getDailyData(groupId: string, start: Date, end: Date): Promise<TimeSeriesPoint[]> {
    const days = eachDayOfInterval({ start, end });
    const data = await this.prisma.expense.groupBy({
      by: ['date'],
      where: {
        groupId,
        date: { gte: startOfDay(start), lte: endOfDay(end) },
        status: 'ACTIVE',
      },
      _sum: { amount: true },
      _count: true,
    });

    const dataMap = new Map(
      data.map((d) => [format(new Date(d.date), 'yyyy-MM-dd'), d]),
    );

    return days.map((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const d = dataMap.get(key);
      return {
        label: format(day, 'MMM d'),
        date: key,
        amount: Number(d?._sum.amount || 0),
        count: d?._count || 0,
      };
    });
  }

  private async getWeeklyData(groupId: string, start: Date, end: Date): Promise<TimeSeriesPoint[]> {
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    const points: TimeSeriesPoint[] = [];

    for (const weekStart of weeks) {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const agg = await this.prisma.expense.aggregate({
        where: {
          groupId,
          date: { gte: weekStart, lte: weekEnd },
          status: 'ACTIVE',
        },
        _sum: { amount: true },
        _count: true,
      });

      points.push({
        label: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`,
        date: format(weekStart, 'yyyy-MM-dd'),
        amount: Number(agg._sum.amount || 0),
        count: agg._count,
      });
    }

    return points;
  }

  private async getMonthlyData(groupId: string, start: Date, end: Date): Promise<TimeSeriesPoint[]> {
    const months = eachMonthOfInterval({ start, end });
    const points: TimeSeriesPoint[] = [];

    for (const monthStart of months) {
      const m = monthStart.getMonth() + 1;
      const y = monthStart.getFullYear();
      const agg = await this.prisma.expense.aggregate({
        where: { groupId, month: m, year: y, status: 'ACTIVE' },
        _sum: { amount: true },
        _count: true,
      });

      points.push({
        label: format(monthStart, 'MMM yyyy'),
        date: format(monthStart, 'yyyy-MM'),
        amount: Number(agg._sum.amount || 0),
        count: agg._count,
      });
    }

    return points;
  }

  private async getCategoryData(groupId: string, start: Date, end: Date): Promise<CategoryBreakdown[]> {
    const raw = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        groupId,
        date: { gte: start, lte: end },
        status: 'ACTIVE',
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    });

    const total = raw.reduce((s, d) => s + Number(d._sum.amount || 0), 0);
    const catIds = raw.map((r) => r.categoryId).filter(Boolean) as string[];
    const cats = await this.prisma.category.findMany({ where: { id: { in: catIds } } });
    const catMap = new Map(cats.map((c) => [c.id, c]));

    return raw.map((r) => {
      const cat = r.categoryId ? catMap.get(r.categoryId) : null;
      const amt = Number(r._sum.amount || 0);
      return {
        categoryId: r.categoryId || 'other',
        categoryName: cat?.name || 'Boshqa',
        icon: cat?.icon || '📦',
        color: cat?.color || '#94a3b8',
        amount: amt,
        count: r._count,
        percentage: total ? Math.round((amt / total) * 100) : 0,
      };
    });
  }

  private async getUserData(groupId: string, start: Date, end: Date): Promise<UserBreakdown[]> {
    const raw = await this.prisma.expense.groupBy({
      by: ['userId'],
      where: {
        groupId,
        date: { gte: start, lte: end },
        status: 'ACTIVE',
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    });

    const total = raw.reduce((s, d) => s + Number(d._sum.amount || 0), 0);
    const userIds = raw.map((r) => r.userId);
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } } });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return raw.map((r) => {
      const user = userMap.get(r.userId);
      const amt = Number(r._sum.amount || 0);
      return {
        userId: r.userId,
        firstName: user?.firstName || 'Unknown',
        username: user?.username || null,
        amount: amt,
        count: r._count,
        percentage: total ? Math.round((amt / total) * 100) : 0,
      };
    });
  }
}
