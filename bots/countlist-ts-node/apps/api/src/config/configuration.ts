import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../../.env') });

export const configuration = () => ({
  port: parseInt(process.env.PORT || process.env.API_PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: 300,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_secret_change_this',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  bot: {
    token: process.env.BOT_TOKEN,
  },
});

export type AppConfig = ReturnType<typeof configuration>;
