import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var ${key}`);
  }
  return value;
}

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((item) => item.trim())
  : ['http://localhost:3000'];

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3001),
  CORS_ORIGIN: corsOrigin,
  SOCKET_PATH: process.env.SOCKET_PATH ?? '/socket.io',
  DATABASE_URL: required('DATABASE_URL'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? required('JWT_SECRET'),
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '15m',
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? '30d',
  TELEGRAM_API_ID: process.env.TELEGRAM_API_ID ?? '33037016',
  TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH ?? '824652a25802bf2b72fcd43865dd9fdc',
  FACEBOOK_VERIFY_TOKEN: process.env.FACEBOOK_VERIFY_TOKEN,
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
};
