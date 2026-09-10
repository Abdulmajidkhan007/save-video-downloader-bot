import { Currency, ExpenseParseResult } from '../types';

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  ming: 1_000,
  мин: 1_000,
  mln: 1_000_000,
  млн: 1_000_000,
  million: 1_000_000,
  milion: 1_000_000,
  mlrd: 1_000_000_000,
  миллиард: 1_000_000_000,
};

const CURRENCY_MAP: Record<string, Currency> = {
  som: 'UZS',
  "so'm": 'UZS',
  "so`m": 'UZS',
  uzs: 'UZS',
  сум: 'UZS',
  usd: 'USD',
  dollar: 'USD',
  доллар: 'USD',
  '$': 'USD',
  eur: 'EUR',
  euro: 'EUR',
  евро: 'EUR',
  '€': 'EUR',
  rub: 'RUB',
  rubl: 'RUB',
  рубль: 'RUB',
  '₽': 'RUB',
};

const CATEGORY_KEYWORDS: Record<string, string> = {
  ovqat: 'Oziq-ovqat',
  taom: 'Oziq-ovqat',
  yeyish: 'Oziq-ovqat',
  non: 'Oziq-ovqat',
  "go'sht": 'Oziq-ovqat',
  gosht: 'Oziq-ovqat',
  sabzavot: 'Oziq-ovqat',
  meva: 'Oziq-ovqat',
  transport: 'Transport',
  taksi: 'Transport',
  metro: 'Transport',
  avtobus: 'Transport',
  benzin: 'Transport',
  yoqilg: 'Transport',
  telefon: 'Texnologiya',
  telefonga: 'Texnologiya',
  internet: 'Texnologiya',
  kompyuter: 'Texnologiya',
  remont: 'Uy-joy',
  ijara: 'Uy-joy',
  uy: 'Uy-joy',
  kommunal: 'Uy-joy',
  kiyim: 'Kiyim-kechak',
  oyoq: 'Kiyim-kechak',
  sport: 'Sport',
  gym: 'Sport',
  dori: 'Sogliq',
  kasalxona: 'Sogliq',
  shifokor: 'Sogliq',
  "o'qish": 'Talim',
  oqish: 'Talim',
  kurs: 'Talim',
  kitob: 'Talim',
  "ta'lim": 'Talim',
  talim: 'Talim',
  kino: 'Kongilochar',
  restoran: 'Kongilochar',
  cafe: 'Kongilochar',
  kafe: 'Kongilochar',
};

export function parseExpenseText(text: string): ExpenseParseResult | null {
  const normalizedText = text.toLowerCase().trim();

  // Pattern: number [multiplier] [currency] description
  // or: number [currency] description
  const patterns = [
    /^(\d[\d\s,.]*)\s*(mln|million|milion|млн|mlrd|миллиард|k|ming|мин)?\s*(so['`]?m|uzs|usd|dollar|доллар|\$|eur|euro|евро|€|rub|rubl|рубль|₽|сум)?\s+(.+)$/i,
    /^(\d[\d\s,.]*)\s*(mln|million|milion|млн|mlrd|миллиард|k|ming|мин)\s+(.+)$/i,
    /^(\d[\d\s,.]*)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (!match) continue;

    const rawAmount = match[1].replace(/[\s,]/g, '').replace(',', '.');
    let amount = parseFloat(rawAmount);
    if (isNaN(amount)) continue;

    // Apply multiplier
    const multiplierKey = match[2]?.toLowerCase();
    if (multiplierKey && MULTIPLIERS[multiplierKey]) {
      amount *= MULTIPLIERS[multiplierKey];
    }

    // Detect currency
    const currencyKey = match[3]?.toLowerCase();
    const currency: Currency = currencyKey && CURRENCY_MAP[currencyKey]
      ? CURRENCY_MAP[currencyKey]
      : 'UZS';

    // Extract description (last capture group)
    const description = (match[match.length - 1] || '').trim();
    if (!description) continue;

    // Detect category from description
    const categoryHint = detectCategory(description);

    return { amount, currency, description, categoryHint };
  }

  return null;
}

function detectCategory(description: string): string | undefined {
  const lower = description.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lower.includes(keyword)) return category;
  }
  return undefined;
}

export function formatAmount(amount: number, currency: Currency = 'UZS'): string {
  if (currency === 'UZS') {
    if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toFixed(1)} mln so'm`;
    }
    if (amount >= 1_000) {
      return `${(amount / 1_000).toFixed(0)}k so'm`;
    }
    return `${amount.toLocaleString()} so'm`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
