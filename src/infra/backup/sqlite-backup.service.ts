import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { env } from '../config/env.js';
import { sqlite } from '../db/index.js';

import { type BackupTarget, createBackupTarget } from './backup-target.js';

type Logger = { info: (msg: string) => void; error: (msg: string) => void };

export type BackupResult =
  | { status: 'uploaded'; name: string; size: number }
  | { status: 'unchanged'; name: string };

function timestamp(d = new Date()) {
  return d.toISOString().replace(/[:.]/g, '-'); // 2026-10-18T04-12-00-000Z
}

async function sha256File(filePath: string) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

/**
 * Consistent SQLite snapshots via the online backup API (safe while the DB is in use),
 * shipped to a BackupTarget. Snapshots are staged in the OS temp dir, not in /app/data,
 * so they never touch the Azure Files share.
 */
export class SqliteBackupService {
  private inFlight: Promise<BackupResult> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly target: BackupTarget = createBackupTarget(),
    private readonly log: Logger = console,
  ) {}

  /**
   * Writes a consistent copy of the live DB to a temp file. Caller must delete it.
   * The DB lives on Azure Files (SMB), where locks can fail transiently — notably while
   * an old revision still holds the file during a rollout — so lock errors are retried.
   */
  async createSnapshot(attempts = 5, delayMs = 5_000): Promise<string> {
    for (let i = 1; ; i++) {
      const file = path.join(os.tmpdir(), `picho-rpg-snapshot-${randomUUID()}.db`);
      try {
        await sqlite.backup(file);
        return file;
      } catch (e) {
        await fsp.rm(file, { force: true });
        const code = (e as { code?: string }).code ?? '';
        const retriable = /BUSY|LOCKED|PROTOCOL/.test(code) || /lock/i.test((e as Error).message);
        if (!retriable || i >= attempts) throw e;
        this.log.info(`[backup] snapshot attempt ${i} hit "${(e as Error).message}", retrying`);
        await new Promise((r) => setTimeout(r, delayMs * i));
      }
    }
  }

  /** Snapshot → upload (skipped when identical to the latest backup) → prune. */
  run(reason: string): Promise<BackupResult> {
    this.inFlight ??= this.doRun(reason).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async doRun(reason: string): Promise<BackupResult> {
    const snapshot = await this.createSnapshot();
    try {
      const sha256 = await sha256File(snapshot);
      const [latest] = await this.target.list();
      if (latest?.sha256 === sha256) {
        this.log.info(`[backup] ${reason}: unchanged since ${latest.name}, skipped`);
        return { status: 'unchanged', name: latest.name };
      }

      const name = `app-${timestamp()}.db`;
      const { size } = await fsp.stat(snapshot);
      await this.target.save(name, snapshot, sha256);
      this.log.info(`[backup] ${reason}: saved ${name} (${size} B) to ${this.target.description}`);
      await this.prune();
      return { status: 'uploaded', name, size };
    } finally {
      await fsp.rm(snapshot, { force: true });
    }
  }

  private async prune() {
    const old = (await this.target.list()).slice(Math.max(1, env.BACKUP_RETENTION));
    for (const entry of old) await this.target.delete(entry.name);
    if (old.length) this.log.info(`[backup] pruned ${old.length} old backup(s)`);
  }

  /**
   * The container scales to zero, so a timer alone would rarely fire. Backups run:
   *  - on boot, if the newest backup is older than the interval;
   *  - every BACKUP_INTERVAL_HOURS while the process is up;
   *  - on shutdown (see app.ts) — i.e. when Azure scales the app down after a session.
   */
  start() {
    const intervalMs = env.BACKUP_INTERVAL_HOURS * 3_600_000;
    const safeRun = (reason: string) =>
      this.run(reason).catch((e: Error) =>
        this.log.error(`[backup] ${reason} failed: ${e.message}`),
      );

    // Delay the boot check so the previous revision has released the DB file.
    const bootTimer = setTimeout(() => {
      void this.target
        .list()
        .then(([latest]) => {
          if (!latest || Date.now() - latest.createdAt.getTime() > intervalMs)
            return safeRun('boot');
        })
        .catch((e: Error) => this.log.error(`[backup] boot check failed: ${e.message}`));
    }, 90_000);
    bootTimer.unref();

    this.timer = setInterval(() => void safeRun('scheduled'), intervalMs);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

export const sqliteBackup = new SqliteBackupService();
