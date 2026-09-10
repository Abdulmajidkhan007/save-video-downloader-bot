import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { categoriesApi } from '@/services/api';
import { useAppSelector } from '@/hooks/useAppSelector';
import { queryClient } from '@/services/query-client';
import toast from 'react-hot-toast';

export function CategoriesPage() {
  const selectedGroupId = useAppSelector((s) => s.ui.selectedGroupId);
  const [showForm, setShowForm] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', icon: '📦', color: '#6366f1' });

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', selectedGroupId],
    queryFn: () => categoriesApi.list(selectedGroupId || undefined).then((r) => r.data?.data || r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => categoriesApi.create({ ...newCat, groupId: selectedGroupId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setShowForm(false);
      setNewCat({ name: '', icon: '📦', color: '#6366f1' });
      toast.success("Kategoriya qo'shildi");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success("Kategoriya o'chirildi");
    },
  });

  if (isLoading) return <PageLoader />;

  const cats = Array.isArray(categories) ? categories : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Kategoriyalar</h1>
          <p className="text-sm text-slate-500 mt-0.5">{cats.length} ta kategoriya</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Qo'shish
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Yangi kategoriya</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Icon</label>
                <input
                  type="text"
                  value={newCat.icon}
                  onChange={(e) => setNewCat((p) => ({ ...p, icon: e.target.value }))}
                  className="input-field text-center text-2xl"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="label">Nom *</label>
                <input
                  type="text"
                  value={newCat.name}
                  onChange={(e) => setNewCat((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Transport"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Rang</label>
                <input
                  type="color"
                  value={newCat.color}
                  onChange={(e) => setNewCat((p) => ({ ...p, color: e.target.value }))}
                  className="input-field h-10 cursor-pointer p-1"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cats.map((cat: any, i: number) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
          >
            <Card hover className="flex items-center gap-3 group">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: cat.color + '20' }}
              >
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{cat.name}</p>
                {cat.isDefault && (
                  <span className="text-xs text-slate-400">Standart</span>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                  <Pencil size={13} />
                </button>
                {!cat.isDefault && (
                  <button
                    onClick={() => deleteMutation.mutate(cat.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
