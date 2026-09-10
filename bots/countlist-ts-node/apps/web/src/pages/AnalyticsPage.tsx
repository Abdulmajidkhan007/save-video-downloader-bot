import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { ExpenseAreaChart } from '@/components/charts/ExpenseAreaChart';
import { CategoryPieChart } from '@/components/charts/CategoryPieChart';
import { ExpenseBarChart } from '@/components/charts/BarChart';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { analyticsApi } from '@/services/api';
import { useAppSelector } from '@/hooks/useAppSelector';
import { formatAmount } from '@/utils/format';

type Period = 'daily' | 'weekly' | 'monthly';

export function AnalyticsPage() {
  const selectedGroupId = useAppSelector((s) => s.ui.selectedGroupId);
  const [period, setPeriod] = useState<Period>('monthly');

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics', 'trends', selectedGroupId, period],
    queryFn: () =>
      analyticsApi.trends(selectedGroupId!, period).then((r) => r.data?.data || r.data),
    enabled: !!selectedGroupId,
  });

  if (isLoading) return <PageLoader />;

  const periodData = period === 'daily' ? analytics?.daily : period === 'weekly' ? analytics?.weekly : analytics?.monthly;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Analitika</h1>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === p
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              {p === 'daily' ? 'Kunlik' : p === 'weekly' ? 'Haftalik' : 'Oylik'}
            </button>
          ))}
        </div>
      </div>

      {/* Main chart */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Xarajatlar dinamikasi
            </h2>
            {periodData?.length && (
              <span className="text-xs text-slate-400">
                Jami: {formatAmount(periodData.reduce((s: number, d: any) => s + d.amount, 0))}
              </span>
            )}
          </div>
          {periodData?.length ? (
            <ExpenseAreaChart data={periodData} />
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Ma'lumot yo'q</div>
          )}
        </Card>
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Kategoriyalar ulushi
            </h2>
            {analytics?.byCategory?.length ? (
              <CategoryPieChart data={analytics.byCategory} />
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Ma'lumot yo'q</div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Foydalanuvchilar bo'yicha
            </h2>
            <div className="space-y-3">
              {(analytics?.byUser || []).slice(0, 6).map((user: any, i: number) => (
                <div key={user.userId} className="flex items-center gap-3">
                  <span className="text-sm w-5">{['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣'][i]}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {user.firstName}
                      </span>
                      <span className="text-xs text-slate-400">{user.percentage}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${user.percentage}%` }}
                        transition={{ delay: i * 0.05 + 0.2, duration: 0.5 }}
                        className="h-full bg-brand-500 rounded-full"
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 w-28 text-right">
                    {formatAmount(user.amount)}
                  </span>
                </div>
              ))}
              {!analytics?.byUser?.length && (
                <div className="text-center text-sm text-slate-400 py-8">Ma'lumot yo'q</div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Category breakdown */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Kategoriyalar bo'yicha batafsil
          </h2>
          {analytics?.byCategory?.length ? (
            <div className="space-y-3">
              {analytics.byCategory.map((cat: any, i: number) => (
                <div key={cat.categoryId} className="flex items-center gap-4">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                    style={{ backgroundColor: cat.color + '20' }}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {cat.categoryName}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{cat.count} ta</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {formatAmount(cat.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${cat.percentage}%` }}
                        transition={{ delay: i * 0.04 + 0.3, duration: 0.5 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 w-10 text-right">{cat.percentage}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-sm text-slate-400 py-8">Ma'lumot yo'q</div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
