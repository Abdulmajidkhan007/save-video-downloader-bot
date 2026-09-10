import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="text-center">
        <p className="text-8xl mb-4">😕</p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">404</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-6">Sahifa topilmadi</p>
        <Link to="/">
          <Button>Bosh sahifaga qaytish</Button>
        </Link>
      </div>
    </div>
  );
}
