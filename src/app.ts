import fs from 'node:fs';
import path from 'node:path';

import { env } from './infra/config/env.js';
import { buildServer } from './infra/http/server.js';

// keep data/ structure stable for sqlite + static files
fs.mkdirSync('data', { recursive: true });
fs.mkdirSync(path.resolve('data', 'uploads'), { recursive: true });

async function main() {
  const app = await buildServer();
  app.ready().then(() => app.printRoutes());
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`API up on :${env.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
