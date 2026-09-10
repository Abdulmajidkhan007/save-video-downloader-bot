import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Receipt, Calendar, BarChart3 } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { ExpenseAreaChart } from '@/components/charts/ExpenseAreaChart';
import { CategoryPieChart } from '@/components/charts/CategoryPieChart';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { analyticsApi, groupsApi, expensesApi } from '@/services/api';
import { useAppSelector } from '@/hooks/useAppSelector';
import { formatAmount } from '@/utils/format';

export function OverviewPage() {
  const selectedGroupId = useAppSelector((s) => s.ui.selectedGroupId);

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list().then((r) => r.data?.data || r.data),
  });

  const groupId = selectedGroupId || groups?.[0]?.id;

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', groupId],
    queryFn: () => analyticsApi.dashboard(groupId!).then((r) => r.data?.data || r.data),
    enabled: !!groupId,
  });

  const { data: analytics } = useQuery({
    queryKey: ['analytics', groupId],
    queryFn: () => analyticsApi.full(groupId!).then((r) => r.data?.data || r.data),
    enabled: !!groupId,
  });

  const { data: recentExpenses } = useQuery({
    queryKey: ['expenses', groupId, 'recent'],
    queryFn: () =>
      expensesApi.list({ groupId, limit: 5, sortOrder: 'desc' }).then((r) => r.data?.data || r.data),
    enabled: !!groupId,
  });

  if (groupsLoading || (groupId && isLoading)) return <PageLoader />;

  if (!groupId) {
    return (
      <EmptyState
        icon="🏢"
        title="Guruh topilmadi"
        description="Telegram botni guruhga qo'shing va /start bosing"
      />
    );
  }

  const stats = dashboard;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {new Date().toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Oylik jami"
          value={formatAmount(stats?.totalAmount || 0)}
          subtitle={`${stats?.totalExpenses || 0} ta xarajat`}
          change={stats?.monthlyChange}
          icon="💰"
          iconBg="bg-brand-50 dark:bg-brand-900/30"
          delay={0}
        />
        <StatCard
          title="Bugun"
          value={formatAmount(stats?.todayAmount || 0)}
          icon="📅"
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
          delay={0.05}
        />
        <StatCard
          title="Kun o'rtacha"
          value={formatAmount(stats?.avgPerDay || 0)}
          icon="📊"
          iconBg="bg-amber-50 dark:bg-amber-900/30"
          delay={0.1}
        />
        <StatCard
          title="Prognoz (oy)"
          value={formatAmount(stats?.projectedMonthly || 0)}
          icon="🎯"
          iconBg="bg-purple-50 dark:bg-purple-900/30"
          delay={0.15}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area chart — 2/3 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Kunlik xarajatlar</h2>
              <span className="text-xs text-slate-400">So'nggi 30 kun</span>
            </div>
            {analytics?.daily?.length ? (
              <ExpenseAreaChart data={analytics.daily.slice(-30)} />
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                Ma'lumot yo'q
              </div>
            )}
          </Card>
        </motion.div>

        {/* Pie chart — 1/3 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Kategoriyalar</h2>
            </div>
            {analytics?.byCategory?.length ? (
              <CategoryPieChart data={analytics.byCategory} />
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                Ma'lumot yo'q
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent expenses */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">So'nggi xarajatlar</h2>
              <a href="/expenses" className="text-xs text-brand-500 hover:text-brand-600 font-medium">
                Barchasi →
              </a>
            </div>
            <div className="space-y-3">
              {(Array.isArray(recentExpenses) ? recentExpenses : recentExpenses?.data || []).slice(0, 5).map((exp: any) => (
                <div key={exp.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm">
                    {exp.category?.icon || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {exp.description}
                    </p>
                    <p className="text-xs text-slate-400">
                      {exp.user?.firstName} • {new Date(exp.date).toLocaleDateString('uz-UZ')}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {formatAmount(Number(exp.amount))}
                  </span>
                </div>
              ))}
              {!recentExpenses?.length && (
                <p className="text-center text-sm text-slate-400 py-4">Hozircha xarajat yo'q</p>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Top users */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card>
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Top sarflovchilar</h2>
            </div>
            <div className="space-y-3">
              {(analytics?.byUser || []).slice(0, 5).map((user: any, i: number) => (
                <div key={user.userId} className="flex items-center gap-3">
                  <span className="text-base w-6 text-center">
                    {['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-semibold text-sm">
                    {user.firstName?.[0] || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {user.firstName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full"
                          style={{ width: `${user.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{user.percentage}%</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatAmount(user.amount)}
                  </span>
                </div>
              ))}
              {!analytics?.byUser?.length && (
                <p className="text-center text-sm text-slate-400 py-4">Ma'lumot yo'q</p>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
