import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Receipt, BarChart3, Tag, Users, Building2,
  Target, RefreshCw, Download, Settings, LogOut, X, Wallet,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppSelector';
import { toggleSidebar } from '@/store/slices/ui.slice';
import { logout } from '@/store/slices/auth.slice';
import { useNavigate } from 'react-router-dom';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses', icon: Receipt, label: 'Xarajatlar' },
  { to: '/analytics', icon: BarChart3, label: 'Analitika' },
  { to: '/categories', icon: Tag, label: 'Kategoriyalar' },
  { to: '/groups', icon: Building2, label: 'Guruhlar' },
  { to: '/users', icon: Users, label: 'Foydalanuvchilar' },
  { to: '/limits', icon: Target, label: 'Limitlar' },
  { to: '/recurring', icon: RefreshCw, label: 'Takroriy' },
  { to: '/exports', icon: Download, label: 'Export' },
  { to: '/settings', icon: Settings, label: 'Sozlamalar' },
];

export function Sidebar() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);
  const user = useAppSelector((s) => s.auth.user);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => dispatch(toggleSidebar())}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-50 lg:z-auto lg:static flex flex-col',
          'w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800',
          'transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'lg:!translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-500 rounded-xl flex items-center justify-center">
              <Wallet size={16} className="text-white" />
            </div>
            <span className="font-bold text-slate-900 dark:text-slate-100 text-base">ExpenseTracker</span>
          </div>
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100',
                    )}
                    onClick={() => window.innerWidth < 1024 && dispatch(toggleSidebar())}
                  >
                    <item.icon size={17} />
                    {item.label}
                    {isActive && (
                      <motion.div
                        layoutId="active-nav"
                        className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1">
            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-400 font-semibold text-sm">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                {user?.firstName || 'Foydalanuvchi'}
              </p>
              <p className="text-xs text-slate-400 truncate">@{user?.username || 'user'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all duration-150"
          >
            <LogOut size={16} />
            Chiqish
          </button>
        </div>
      </aside>
    </>
  );
}
