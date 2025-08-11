import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infra/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/app.db',
  },
  strict: true,
  verbose: true,
});
