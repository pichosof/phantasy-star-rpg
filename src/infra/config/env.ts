import * as dotenv from 'dotenv';
dotenv.config();

function required(name: string, def?: string) {
  const v = process.env[name] ?? def;
  if (v === undefined) throw new Error(`Missing env var: ${name}`);
  return v;
}

const NODE_ENV = required('NODE_ENV', 'development');
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

export const env = {
  PORT: Number(required('PORT', '3000')),
  NODE_ENV,
  DATABASE_URL: required('DATABASE_URL', './data/app.db'),
  CORS_ORIGIN,
  /** Parsed allow-list from the comma-separated CORS_ORIGIN (trailing slashes removed). */
  CORS_ORIGINS: CORS_ORIGIN.split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  FILE_STORAGE_DRIVER: required('FILE_STORAGE_DRIVER', 'local'),
  UPLOADS_LOCAL_DIR: required('UPLOADS_LOCAL_DIR', './data/uploads'),
  AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING ?? '',
  AZURE_STORAGE_CONTAINER: required('AZURE_STORAGE_CONTAINER', 'uploads'),
  AZURE_STORAGE_ACCESS_TIER: required('AZURE_STORAGE_ACCESS_TIER', 'Cool'),

  // ── SQLite backups ──
  // Enabled by default in production only. Target follows FILE_STORAGE_DRIVER:
  // a private Blob container for azure-blob, a local directory otherwise.
  BACKUP_ENABLED: (process.env.BACKUP_ENABLED ?? String(NODE_ENV === 'production')) === 'true',
  BACKUP_INTERVAL_HOURS: Number(required('BACKUP_INTERVAL_HOURS', '6')),
  BACKUP_RETENTION: Number(required('BACKUP_RETENTION', '30')),
  AZURE_BACKUP_CONTAINER: required('AZURE_BACKUP_CONTAINER', 'db-backups'),
  BACKUP_LOCAL_DIR: required('BACKUP_LOCAL_DIR', './data/backups'),
};
