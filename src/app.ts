import fs from 'node:fs';
import path from 'node:path';

import { sqliteBackup } from './infra/backup/sqlite-backup.service.js';
import { env } from './infra/config/env.js';
import { DiscordBot } from './infra/discord/bot.js';
import { buildServer } from './infra/http/server.js';

// keep data/ structure stable for sqlite + static files
fs.mkdirSync('data', { recursive: true });
fs.mkdirSync(path.resolve(env.UPLOADS_LOCAL_DIR), { recursive: true });
fs.mkdirSync(path.resolve('data', 'tmp'), { recursive: true });

async function main() {
  const app = await buildServer();
  app.ready().then(() => app.printRoutes());
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`API up on :${env.PORT}`);

  if (env.BACKUP_ENABLED) sqliteBackup.start();

  // Optional Discord bot, in this same process (needs the always-on replica). A bot that
  // fails to start is logged and reported as 503 by /api/health/discord (the deploy checks it);
  // the site itself stays up, since the startup probe only looks at /api/health.
  const bot = env.DISCORD ? new DiscordBot(app.log) : null;
  await bot?.start().catch((err: unknown) => app.log.error(err, '[discord] failed to start'));

  // Container Apps sends SIGTERM on scale-to-zero / new revision (30s grace).
  // Take a last backup so the session that just ended is captured.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`[shutdown] ${signal} received`);
    // Leave Discord first: during a revision swap the new replica takes over the commands.
    await bot?.stop().catch((err: unknown) => app.log.error(err, '[discord] stop failed'));
    sqliteBackup.stop();
    if (env.BACKUP_ENABLED) {
      const timeout = new Promise((resolve) => setTimeout(resolve, 20_000));
      await Promise.race([sqliteBackup.run('shutdown').catch(() => undefined), timeout]);
    }
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
