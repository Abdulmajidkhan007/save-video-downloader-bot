import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number;
  icon: ReactNode;
  iconBg?: string;
  delay?: number;
}

export function StatCard({ title, value, subtitle, change, icon, iconBg, delay = 0 }: StatCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === 0 || change === undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="card p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</span>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-lg', iconBg || 'bg-brand-50 dark:bg-brand-900/30')}>
          {icon}
        </div>
      </div>

      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{value}</p>
        {subtitle && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>

      {change !== undefined && (
        <div className={cn(
          'flex items-center gap-1 text-xs font-medium',
          isPositive && 'text-red-500',
          isNegative && 'text-emerald-500',
          isNeutral && 'text-slate-400',
        )}>
          {isPositive && <TrendingUp size={13} />}
          {isNegative && <TrendingDown size={13} />}
          {isNeutral && <Minus size={13} />}
          <span>
            {change > 0 ? '+' : ''}{change.toFixed(1)}% o'tgan oyga nisbatan
          </span>
        </div>
      )}
    </motion.div>
  );
}
