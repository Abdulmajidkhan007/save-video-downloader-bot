import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wallet, Send, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAppDispatch } from '@/hooks/useAppSelector';
import { setAuth } from '@/store/slices/auth.slice';
import { authApi } from '@/services/api';
import toast from 'react-hot-toast';

export function LoginPage() {
  const [telegramId, setTelegramId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramId || !firstName) {
      toast.error('Telegram ID va ismni kiriting');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.loginTelegram(telegramId, firstName, username);
      const payload = data.data || data;
      dispatch(setAuth({
        user: payload.user,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      }));
      toast.success(`Xush kelibsiz, ${payload.user.firstName}!`);
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Kirish muvaffaqiyatsiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-brand-500/30"
            >
              <Wallet size={28} className="text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white">Expense Tracker</h1>
            <p className="text-slate-400 text-sm mt-1">Xarajatlaringizni boshqaring</p>
          </div>

          {/* Demo note */}
          <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-2">
              <Send size={15} className="text-brand-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-brand-300 text-xs font-medium mb-0.5">Bot orqali kirish</p>
                <p className="text-brand-400/80 text-xs">
                  Telegram botingizdan /start bosing va dashboard linkini oling. Yoki quyida Telegram ID ni kiriting.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Telegram ID *
              </label>
              <input
                type="text"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="123456789"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/50 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Ism *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ali"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/50 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Username (ixtiyoriy)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="alijon"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/50 transition-all text-sm"
              />
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full py-3 text-base bg-brand-500 hover:bg-brand-600 rounded-xl font-semibold"
            >
              Kirish
            </Button>
          </form>

          <p className="text-center text-slate-500 text-xs mt-6">
            Telegram botni guruhga qo'shib, /start bosing
          </p>
        </div>
      </motion.div>
    </div>
  );
}
