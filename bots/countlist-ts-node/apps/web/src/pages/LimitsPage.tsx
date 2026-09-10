import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { limitsApi, categoriesApi } from '@/services/api';
import { useAppSelector } from '@/hooks/useAppSelector';
import { queryClient } from '@/services/query-client';
import { formatAmount } from '@/utils/format';
import toast from 'react-hot-toast';

export function LimitsPage() {
  const selectedGroupId = useAppSelector((s) => s.ui.selectedGroupId);
  const now = new Date();
  const [month] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', categoryId: '', currency: 'UZS' });

  const { data: limits, isLoading } = useQuery({
    queryKey: ['limits', selectedGroupId, month, year],
    queryFn: () =>
      limitsApi.list(selectedGroupId!, month, year).then((r) => r.data?.data || r.data),
    enabled: !!selectedGroupId,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories', selectedGroupId],
    queryFn: () => categoriesApi.list(selectedGroupId || undefined).then((r) => r.data?.data || r.data),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      limitsApi.set({
        ...form,
        amount: parseFloat(form.amount),
        groupId: selectedGroupId!,
        month,
        year,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['limits'] });
      setShowForm(false);
      toast.success('Limit o\'rnatildi');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => limitsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['limits'] });
      toast.success("Limit o'chirildi");
    },
  });

  if (isLoading) return <PageLoader />;

  const limitsArr = Array.isArray(limits) ? limits : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Oylik Limitlar</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {now.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Limit qo'shish
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Yangi limit</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Kategoriya</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
                  className="input-field"
                >
                  <option value="">Barcha kategoriyalar</option>
                  {(Array.isArray(categories) ? categories : []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Limit miqdori *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="1000000"
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
                Saqlash
              </Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>Bekor</Button>
            </div>
          </Card>
        </motion.div>
      )}

      {limitsArr.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-3xl mx-auto mb-3">
              🎯
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Limit yo'q</h3>
            <p className="text-sm text-slate-500">Oylik xarajat limitlarini o'rnating</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {limitsArr.map((limit: any, i: number) => {
            const pct = limit.percentage;
            const statusColor = limit.isExceeded
              ? '#ef4444'
              : limit.isWarning
              ? '#f59e0b'
              : '#10b981';

            return (
              <motion.div
                key={limit.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        style={{ backgroundColor: (limit.category?.color || '#6366f1') + '20' }}
                      >
                        {limit.category?.icon || '🎯'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {limit.category?.name || 'Umumiy limit'}
                        </p>
                        {limit.user && (
                          <p className="text-xs text-slate-400">{limit.user.firstName}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={limit.isExceeded ? 'danger' : limit.isWarning ? 'warning' : 'success'}>
                        {limit.isExceeded ? '🔴 Oshdi' : limit.isWarning ? '🟡 Ogohlantirish' : '🟢 Normal'}
                      </Badge>
                      <button
                        onClick={() => deleteMutation.mutate(limit.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <XCircle size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Sarflandi: <strong className="text-slate-900 dark:text-slate-100">{formatAmount(limit.spentAmount)}</strong>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        Limit: <strong className="text-slate-900 dark:text-slate-100">{formatAmount(Number(limit.amount))}</strong>
                      </span>
                    </div>

                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(pct, 100)}%` }}
                        transition={{ delay: i * 0.05 + 0.2, duration: 0.6 }}
                        className="h-full rounded-full transition-all"
                        style={{ backgroundColor: statusColor }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{pct}% ishlatildi</span>
                      <span>
                        {limit.isExceeded
                          ? `${formatAmount(Math.abs(limit.remaining))} oshdi`
                          : `${formatAmount(limit.remaining)} qoldi`}
                      </span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
