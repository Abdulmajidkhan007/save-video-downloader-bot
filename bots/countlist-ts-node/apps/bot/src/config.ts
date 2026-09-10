import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  bot: {
    token: required('BOT_TOKEN'),
    webhookUrl: process.env.BOT_WEBHOOK_URL,
    adminId: process.env.ADMIN_TELEGRAM_ID && /^\d+$/.test(process.env.ADMIN_TELEGRAM_ID)
      ? BigInt(process.env.ADMIN_TELEGRAM_ID)
      : null,
  },
  database: {
    url: required('DATABASE_URL'),
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  api: {
    url: process.env.API_URL || 'http://localhost:3001',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;
