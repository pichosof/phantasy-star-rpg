#!/usr/bin/env node
/**
 * One-command production release for both repos.
 *
 *   npm run release                 # back + front
 *   npm run release -- back         # only the API
 *   npm run release -- front        # only the web app
 *   npm run release -- --dry-run    # run every check, push nothing
 *   npm run release -- --no-watch   # push/dispatch and return immediately
 *   npm run release -- --front-dir=../other/path
 *
 * For each repo: must be on a clean `main` that is not behind origin → runs the same
 * checks CI runs → pushes `main` (which triggers deploy-production.yml). If the push
 * does not start a run (nothing new, or no deploy-relevant path changed) the workflow
 * is dispatched manually. Then it follows the run until it finishes (`gh run watch`).
 *
 * Requires: git, node, npm/npx, and `gh` authenticated for both repos.
 */
import { execSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

const backDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontDir = path.resolve(backDir, option('front-dir') ?? '../phantasy-star-rpg.front');
const picked = args.filter((a) => !a.startsWith('--'));
const targets = picked.length ? picked : ['back', 'front'];
const dryRun = flag('dry-run');
const watch = !flag('no-watch');
const WORKFLOW = 'deploy-production.yml';

const REPOS = {
  back: {
    dir: backDir,
    checks: ['npm run lint', 'npm run build', 'npm run test:run'],
  },
  front: {
    dir: frontDir,
    checks: [
      'npx tsc --noEmit',
      'npx eslint "*/**/*.{js,ts,tsx}"',
      'node scripts/check-theme-isolation.mjs --strict',
      'node scripts/check-theme-contrast.mjs --strict',
      'npx vite build',
    ],
  },
};

const log = (msg) => console.log(`\x1b[36m›\x1b[0m ${msg}`);
const fail = (msg) => {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
};
const out = (cmd, cwd) => execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const run = (cmd, cwd) => {
  const r = spawnSync(cmd, { cwd, shell: true, stdio: 'inherit' });
  if (r.status !== 0) fail(`"${cmd}" failed in ${cwd}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const t of targets) if (!REPOS[t]) fail(`Unknown target "${t}" (use back and/or front).`);

// 1) Preconditions for every target first: nothing is pushed if any repo is not ready.
for (const t of targets) {
  const { dir } = REPOS[t];
  log(`[${t}] ${dir}`);
  const branch = out('git rev-parse --abbrev-ref HEAD', dir);
  if (branch !== 'main') fail(`[${t}] on branch "${branch}"; releases go from main.`);
  if (out('git status --porcelain', dir)) fail(`[${t}] working tree is not clean; commit or stash first.`);
  out('git fetch origin main', dir);
  const behind = Number(out('git rev-list --count HEAD..origin/main', dir));
  if (behind > 0) fail(`[${t}] is ${behind} commit(s) behind origin/main; pull first.`);
}

// 2) Same checks as CI.
for (const t of targets) {
  for (const cmd of REPOS[t].checks) {
    log(`[${t}] ${cmd}`);
    run(cmd, REPOS[t].dir);
  }
}

if (dryRun) {
  log('Dry run: all checks passed, nothing pushed.');
  process.exit(0);
}

// 3) Push (or dispatch) and follow the deploy run.
const findRun = (dir, sha) => {
  const json = out(`gh run list --workflow ${WORKFLOW} --branch main --limit 10 --json databaseId,headSha,event`, dir);
  return JSON.parse(json).find((r) => r.headSha === sha);
};

for (const t of targets) {
  const { dir } = REPOS[t];
  const sha = out('git rev-parse HEAD', dir);
  const ahead = Number(out('git rev-list --count origin/main..HEAD', dir));
  const before = findRun(dir, sha)?.databaseId;

  if (ahead > 0) {
    log(`[${t}] pushing ${ahead} commit(s)`);
    run('git push origin main', dir);
  }

  let started;
  for (let i = 0; i < (ahead > 0 ? 8 : 0); i += 1) {
    await sleep(4000);
    const r = findRun(dir, sha);
    if (r && r.databaseId !== before) {
      started = r;
      break;
    }
  }
  if (!started) {
    log(`[${t}] no deploy run started by the push; dispatching ${WORKFLOW}`);
    run(`gh workflow run ${WORKFLOW} --ref main`, dir);
    for (let i = 0; i < 10 && !started; i += 1) {
      await sleep(4000);
      const r = findRun(dir, sha);
      if (r && r.databaseId !== before) started = r;
    }
    if (!started) fail(`[${t}] could not find the dispatched run; check "gh run list".`);
  }

  log(`[${t}] deploy run ${started.databaseId} started`);
  if (watch) run(`gh run watch ${started.databaseId} --exit-status`, dir);
}

log(watch ? 'Release finished.' : 'Release started; follow it with "gh run list".');
