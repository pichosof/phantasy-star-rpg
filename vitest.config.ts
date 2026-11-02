import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    coverage: { reporter: ['text', 'html'] },
    include: ['tests/**/*.test.ts'],
    // Deterministic config: never depends on the developer's .env (dotenv does not override these).
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: './data/test.db',
      CORS_ORIGIN: '*',
      FILE_STORAGE_DRIVER: 'local',
      UPLOADS_LOCAL_DIR: './data/test-uploads',
      BACKUP_ENABLED: 'false',
      BACKUP_LOCAL_DIR: './data/test-backups',
      CLIENT_SECRET: 'test-client-secret',
      GM_API_KEY: 'Test-GM-Key-0123456789-abcdef',
      JWT_SECRET: 'test-jwt-secret-0123456789-abcdef',
      // Discord bot config (the bot itself is never started by tests).
      DISCORD_TOKEN: 'test-discord-token',
      DISCORD_GUILD_IDS: 'test-guild',
      DISCORD_GM_USER_IDS: 'gm-user',
      DISCORD_ANNOUNCE_CHANNEL_ID: '',
      SITE_URL: 'https://site.test',
      PUBLIC_API_URL: 'https://api.test',
    },
    // SQLite file locking: one file at a time.
    fileParallelism: false,
  },
});
