import { buildServer } from './infra/http/server.js';
import { env } from './infra/config/env.js';
import fs from 'node:fs';

fs.mkdirSync('uploads', { recursive: true });

async function main() {
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`API up on :${env.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
