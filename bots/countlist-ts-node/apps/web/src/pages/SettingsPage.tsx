import { motion } from 'framer-motion';
import { Sun, Moon, Bell, Globe, Shield } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppSelector';
import { toggleTheme } from '@/store/slices/ui.slice';

export function SettingsPage() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);
  const user = useAppSelector((s) => s.auth.user);

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sozlamalar</h1>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Shield size={16} /> Profil
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 text-2xl font-bold">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{user?.firstName}</p>
              <p className="text-sm text-slate-400">@{user?.username || 'username'}</p>
              <p className="text-xs text-slate-400">ID: {user?.telegramId}</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Appearance */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Sun size={16} /> Ko'rinish
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Tema</p>
              <p className="text-xs text-slate-400 mt-0.5">Interfeys rangini tanlang</p>
            </div>
            <button
              onClick={() => dispatch(toggleTheme())}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
              {theme === 'dark' ? 'Qorong\'u' : 'Yorug\''}
            </button>
          </div>
        </Card>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Bell size={16} /> Bildirishnomalar
          </h2>
          {[
            { label: "Xarajat qo'shilganda", desc: 'Yangi xarajat kiritilganda xabar olish' },
            { label: 'Limit ogohlantirishlari', desc: "Limit 80% ga yetganda xabar olish" },
            { label: 'Oylik hisobot', desc: "Har oy boshida hisobot olish" },
          ].map((item, i) => (
            <div key={i} className={`flex items-center justify-between py-3 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked={i === 0} className="sr-only peer" />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500" />
              </label>
            </div>
          ))}
        </Card>
      </motion.div>

      {/* Language */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Globe size={16} /> Til
          </h2>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-900 dark:text-slate-100">Interfeys tili</p>
            <select className="input-field w-36">
              <option value="uz">🇺🇿 O'zbek</option>
              <option value="ru">🇷🇺 Русский</option>
              <option value="en">🇺🇸 English</option>
            </select>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
