import * as dotenv from 'dotenv';
dotenv.config();

function required(name: string, def?: string) {
  const v = process.env[name] ?? def;
  if (v === undefined) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  PORT: Number(required('PORT', '3000')),
  NODE_ENV: required('NODE_ENV', 'development'),
  DATABASE_URL: required('DATABASE_URL', './data/app.db'),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
  FILE_STORAGE_DRIVER: required('FILE_STORAGE_DRIVER', 'local'),
  UPLOADS_LOCAL_DIR: required('UPLOADS_LOCAL_DIR', './data/uploads'),
  AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING ?? '',
  AZURE_STORAGE_CONTAINER: required('AZURE_STORAGE_CONTAINER', 'uploads'),
  AZURE_STORAGE_ACCESS_TIER: required('AZURE_STORAGE_ACCESS_TIER', 'Cool'),
};
