import { PrismaClient, Expense, Prisma } from '@prisma/client';
import { parseExpenseText, formatAmount, getWeekNumber, getDayOfYear } from '@expense-tracker/shared';
import { logger } from '../utils/logger';
import { deleteCacheValue } from '../utils/redis';

export class ExpenseService {
  constructor(private prisma: PrismaClient) {}

  async parseAndCreate(params: {
    rawText: string;
    userId: string;
    groupId: string;
    telegramMsgId?: bigint;
  }): Promise<{ expense: Expense; formatted: string } | null> {
    const parsed = parseExpenseText(params.rawText);
    if (!parsed) return null;

    const now = new Date();
    const category = parsed.categoryHint
      ? await this.prisma.category.findFirst({
          where: {
            OR: [{ groupId: params.groupId }, { isDefault: true }],
            name: parsed.categoryHint,
          },
        })
      : null;

    const expense = await this.prisma.expense.create({
      data: {
        userId: params.userId,
        groupId: params.groupId,
        categoryId: category?.id,
        amount: new Prisma.Decimal(parsed.amount),
        currency: parsed.currency,
        description: parsed.description,
        rawText: params.rawText,
        date: now,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        week: getWeekNumber(now),
        dayOfYear: getDayOfYear(now),
        source: 'TEXT',
        telegramMsgId: params.telegramMsgId,
      },
      include: { category: true, user: true },
    });

    await this.invalidateGroupCache(params.groupId);

    const formatted = this.formatExpenseMessage(expense as Expense & {
      category: { name: string; icon: string } | null;
      user: { firstName: string };
    });

    logger.info(`Expense created: ${expense.id} - ${parsed.amount} ${parsed.currency}`);
    return { expense, formatted };
  }

  private formatExpenseMessage(
    expense: Expense & { category: { name: string; icon: string } | null; user: { firstName: string } },
  ): string {
    const amount = formatAmount(Number(expense.amount), expense.currency as 'UZS');
    const cat = expense.category
      ? `${expense.category.icon} ${expense.category.name}`
      : '📦 Boshqa';

    return (
      `✅ *Xarajat qo'shildi*\n\n` +
      `👤 ${expense.user.firstName}\n` +
      `💵 *${amount}*\n` +
      `📝 ${expense.description}\n` +
      `🏷 ${cat}\n` +
      `📅 ${new Date(expense.date).toLocaleDateString('uz-UZ')}`
    );
  }

  async getTodayStats(groupId: string): Promise<string> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);

    const [expenses, total] = await Promise.all([
      this.prisma.expense.findMany({
        where: {
          groupId,
          date: { gte: startOfDay, lte: endOfDay },
          status: 'ACTIVE',
        },
        include: { user: true, category: true },
        orderBy: { date: 'desc' },
        take: 10,
      }),
      this.prisma.expense.aggregate({
        where: {
          groupId,
          date: { gte: startOfDay, lte: endOfDay },
          status: 'ACTIVE',
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    if (expenses.length === 0) {
      return '📅 *Bugun hech qanday xarajat yo\'q*\n\nXarajat qo\'shish uchun:\n`500000 so\'m ovqatga`';
    }

    const totalAmount = formatAmount(Number(total._sum.amount || 0));
    let msg = `📅 *Bugungi xarajatlar*\n`;
    msg += `💰 Jami: *${totalAmount}* (${total._count} ta)\n\n`;

    for (const exp of expenses.slice(0, 5)) {
      const amt = formatAmount(Number(exp.amount));
      const cat = exp.category ? `${exp.category.icon}` : '📦';
      msg += `${cat} ${exp.description} — *${amt}*\n`;
      msg += `   👤 ${exp.user.firstName}\n`;
    }

    if (expenses.length > 5) {
      msg += `\n_va yana ${expenses.length - 5} ta..._`;
    }

    return msg;
  }

  async getWeekStats(groupId: string): Promise<string> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);

    const [total, byDay] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { groupId, date: { gte: weekStart }, status: 'ACTIVE' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.groupBy({
        by: ['dayOfYear'],
        where: { groupId, date: { gte: weekStart }, status: 'ACTIVE' },
        _sum: { amount: true },
        orderBy: { dayOfYear: 'asc' },
      }),
    ]);

    const totalAmount = formatAmount(Number(total._sum.amount || 0));
    const dayNames = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Yak'];

    let msg = `📆 *Haftalik xarajatlar*\n`;
    msg += `💰 Jami: *${totalAmount}* (${total._count} ta)\n\n`;

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      const dayNum = getDayOfYear(dayDate);
      const dayData = byDay.find((d) => d.dayOfYear === dayNum);
      const dayTotal = dayData ? formatAmount(Number(dayData._sum.amount || 0)) : '—';
      const bar = dayData ? '▓'.repeat(Math.min(10, Math.floor(Number(dayData._sum.amount || 0) / 100000))) : '';
      msg += `${dayNames[i]}: ${dayTotal} ${bar}\n`;
    }

    return msg;
  }

  async getMonthStats(groupId: string): Promise<string> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [total, byCategory, topUsers] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { groupId, month, year, status: 'ACTIVE' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where: { groupId, month, year, status: 'ACTIVE' },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
      this.prisma.expense.groupBy({
        by: ['userId'],
        where: { groupId, month, year, status: 'ACTIVE' },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
    ]);

    const totalAmount = formatAmount(Number(total._sum.amount || 0));
    const monthName = now.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });

    let msg = `🗓 *${monthName} xarajatlari*\n`;
    msg += `💰 Jami: *${totalAmount}* (${total._count} ta)\n\n`;

    if (byCategory.length > 0) {
      msg += `📊 *Kategoriyalar bo'yicha:*\n`;
      const catIds = byCategory.map((c) => c.categoryId).filter(Boolean) as string[];
      const cats = await this.prisma.category.findMany({ where: { id: { in: catIds } } });
      const catMap = new Map(cats.map((c) => [c.id, c]));

      for (const cat of byCategory) {
        const catInfo = cat.categoryId ? catMap.get(cat.categoryId) : null;
        const icon = catInfo?.icon || '📦';
        const name = catInfo?.name || 'Boshqa';
        const pct = total._sum.amount
          ? Math.round((Number(cat._sum.amount) / Number(total._sum.amount)) * 100)
          : 0;
        msg += `${icon} ${name}: *${formatAmount(Number(cat._sum.amount))}* (${pct}%)\n`;
      }
    }

    if (topUsers.length > 0) {
      msg += `\n👥 *Top sarflovchilar:*\n`;
      const userIds = topUsers.map((u) => u.userId);
      const users = await this.prisma.user.findMany({ where: { id: { in: userIds } } });
      const userMap = new Map(users.map((u) => [u.id, u]));

      for (let i = 0; i < topUsers.length; i++) {
        const u = topUsers[i];
        const userInfo = userMap.get(u.userId);
        const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
        msg += `${medal} ${userInfo?.firstName || 'User'}: *${formatAmount(Number(u._sum.amount))}*\n`;
      }
    }

    return msg;
  }

  async getTopCategories(groupId: string, month?: number, year?: number): Promise<string> {
    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();

    const data = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      where: { groupId, month: m, year: y, status: 'ACTIVE' },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    });

    if (data.length === 0) {
      return '📊 Hozircha xarajat kategoriyalari mavjud emas';
    }

    const catIds = data.map((d) => d.categoryId).filter(Boolean) as string[];
    const cats = await this.prisma.category.findMany({ where: { id: { in: catIds } } });
    const catMap = new Map(cats.map((c) => [c.id, c]));

    const total = data.reduce((s, d) => s + Number(d._sum.amount || 0), 0);

    let msg = `📊 *Kategoriyalar reytingi*\n`;
    msg += `📅 ${now.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })}\n\n`;

    data.forEach((d, i) => {
      const cat = d.categoryId ? catMap.get(d.categoryId) : null;
      const icon = cat?.icon || '📦';
      const name = cat?.name || 'Boshqa';
      const amount = formatAmount(Number(d._sum.amount || 0));
      const pct = total ? Math.round((Number(d._sum.amount) / total) * 100) : 0;
      const bar = '█'.repeat(Math.floor(pct / 10));
      msg += `${i + 1}. ${icon} *${name}*\n`;
      msg += `   ${amount} • ${pct}% ${bar}\n`;
      msg += `   ${d._count} ta xarajat\n\n`;
    });

    return msg;
  }

  private async invalidateGroupCache(groupId: string): Promise<void> {
    await Promise.all([
      deleteCacheValue(`stats:today:${groupId}`),
      deleteCacheValue(`stats:week:${groupId}`),
      deleteCacheValue(`stats:month:${groupId}`),
    ]);
  }
}
