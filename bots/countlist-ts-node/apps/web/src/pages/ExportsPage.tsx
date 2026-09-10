import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FileText, Table, Sheet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { exportsApi } from '@/services/api';
import { useAppSelector } from '@/hooks/useAppSelector';
import toast from 'react-hot-toast';

const formats = [
  { id: 'PDF', icon: '📄', label: 'PDF', description: "Chop etish uchun qulay format", color: '#ef4444' },
  { id: 'CSV', icon: '📊', label: 'CSV', description: 'Excel va Google Sheets uchun', color: '#10b981' },
  { id: 'EXCEL', icon: '📈', label: 'Excel', description: "Batafsil tahlil uchun .xlsx", color: '#3b82f6' },
];

export function ExportsPage() {
  const selectedGroupId = useAppSelector((s) => s.ui.selectedGroupId);
  const [loading, setLoading] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleExport = async (format: string) => {
    if (!selectedGroupId) {
      toast.error('Guruh tanlanmagan');
      return;
    }

    setLoading(format);
    try {
      const { data } = await exportsApi.generate({
        format,
        groupId: selectedGroupId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      const mimeTypes: Record<string, string> = {
        PDF: 'application/pdf',
        CSV: 'text/csv',
        EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
      const extensions: Record<string, string> = { PDF: '.pdf', CSV: '.csv', EXCEL: '.xlsx' };

      const url = URL.createObjectURL(new Blob([data], { type: mimeTypes[format] }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses-${Date.now()}${extensions[format]}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${format} fayl yuklandi`);
    } catch {
      toast.error('Export muvaffaqiyatsiz');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Export</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Ma'lumotlarni yuklab oling
        </p>
      </div>

      {/* Date filter */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Sana oralig'i (ixtiyoriy)
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Boshlanish sanasi</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Tugash sanasi</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </Card>

      {/* Format cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {formats.map((fmt, i) => (
          <motion.div
            key={fmt.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card hover className="flex flex-col gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: fmt.color + '15' }}
              >
                {fmt.icon}
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{fmt.label}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{fmt.description}</p>
              </div>
              <Button
                variant="secondary"
                loading={loading === fmt.id}
                onClick={() => handleExport(fmt.id)}
                className="w-full justify-center"
              >
                <Download size={15} />
                Yuklash
              </Button>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Info */}
      <Card className="bg-brand-50/50 dark:bg-brand-900/10 border-brand-100 dark:border-brand-800">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Export haqida
            </h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>• Sana tanlanmasa, barcha xarajatlar yuklanadi</li>
              <li>• PDF — chop etish va almashish uchun</li>
              <li>• CSV — boshqa dasturlarga import qilish uchun</li>
              <li>• Excel — pivot table va tahlil uchun</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
