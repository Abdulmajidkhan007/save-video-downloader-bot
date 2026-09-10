export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRangeQuery {
  startDate?: string;
  endDate?: string;
  month?: number;
  year?: number;
  week?: number;
}

export type Currency = 'UZS' | 'USD' | 'EUR' | 'RUB';

export const CURRENCIES: Currency[] = ['UZS', 'USD', 'EUR', 'RUB'];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  UZS: "so'm",
  USD: '$',
  EUR: '€',
  RUB: '₽',
};

export interface ExpenseParseResult {
  amount: number;
  currency: Currency;
  description: string;
  categoryHint?: string;
}

export interface DashboardStats {
  totalExpenses: number;
  totalAmount: number;
  currency: string;
  avgPerDay: number;
  topCategory: string | null;
  monthlyChange: number;
}

export interface AnalyticsData {
  daily: TimeSeriesPoint[];
  weekly: TimeSeriesPoint[];
  monthly: TimeSeriesPoint[];
  byCategory: CategoryBreakdown[];
  byUser: UserBreakdown[];
}

export interface TimeSeriesPoint {
  label: string;
  amount: number;
  count: number;
  date: string;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  icon: string;
  color: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface UserBreakdown {
  userId: string;
  firstName: string;
  username: string | null;
  amount: number;
  count: number;
  percentage: number;
}
