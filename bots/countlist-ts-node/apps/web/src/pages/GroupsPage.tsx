import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Receipt, Settings } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { groupsApi } from '@/services/api';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppSelector';
import { setSelectedGroup } from '@/store/slices/ui.slice';
import { formatAmount } from '@/utils/format';

export function GroupsPage() {
  const dispatch = useAppDispatch();
  const selectedGroupId = useAppSelector((s) => s.ui.selectedGroupId);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list().then((r) => r.data?.data || r.data),
  });

  if (isLoading) return <PageLoader />;

  const groupList = Array.isArray(groups) ? groups : [];

  if (groupList.length === 0) {
    return (
      <EmptyState
        icon="🏢"
        title="Guruhlar yo'q"
        description="Telegram botni guruhga qo'shing va /start bosing"
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Guruhlar</h1>
        <p className="text-sm text-slate-500 mt-0.5">{groupList.length} ta guruh</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupList.map((group: any, i: number) => {
          const isSelected = group.id === selectedGroupId;
          return (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Card
                hover
                onClick={() => dispatch(setSelectedGroup(group.id))}
                className={isSelected ? 'ring-2 ring-brand-500 ring-offset-2' : ''}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xl">
                      🏢
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{group.title}</p>
                      {group.username && (
                        <p className="text-xs text-slate-400">@{group.username}</p>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="px-2 py-0.5 bg-brand-500 text-white text-xs rounded-full">
                      Tanlangan
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Users size={14} />
                    <span>{group._count?.members || 0} a'zo</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Receipt size={14} />
                    <span>{group._count?.expenses || 0} xarajat</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Valyuta</span>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {group.currency}
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
