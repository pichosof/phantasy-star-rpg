import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

import { env } from '../config/env.js';
import { ensureRuntimeTables, sqlite } from '../db/index.js';

import { type BackupTarget, createBackupTarget } from './backup-target.js';

type Logger = { info: (msg: string) => void; error: (msg: string) => void };

export type BackupResult =
  | { status: 'uploaded'; name: string; size: number }
  | { status: 'unchanged'; name: string };

export interface RestoreResult {
  restoredFrom: string;
  /** Backup of the database as it was right before the restore. */
  safetyBackup: string;
}

/** A restore input that is not a usable Picho-RPG database (→ 400). */
export class InvalidBackupError extends Error {
  readonly statusCode = 400;
}

/** Names produced by this service; anything else is rejected (no path tricks). */
export const BACKUP_NAME = /^app-[0-9TZ-]+\.db$/;

/** Tables every Picho-RPG database has had since the first releases. */
const CORE_TABLES = ['players', 'cities', 'npcs', 'sessions', 'quests', 'lores', 'worlds'];

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

  listBackups() {
    return this.target.list();
  }

  /**
   * Replaces the live database with a backup (by name) or an uploaded file.
   * 1. validates the candidate (SQLite header, integrity_check, core tables);
   * 2. takes a safety backup of the current database;
   * 3. copies the candidate over the live DB with the SQLite online backup API, so the
   *    open connection stays valid and sees the restored data immediately.
   */
  async restore(
    source: { name: string } | { file: string; label: string },
  ): Promise<RestoreResult> {
    if (this.inFlight) await this.inFlight.catch(() => undefined);
    if (this.restoring) throw new InvalidBackupError('A restore is already running.');
    this.restoring = true;

    const candidate = path.join(os.tmpdir(), `picho-rpg-restore-${randomUUID()}.db`);
    try {
      let label: string;
      if ('name' in source) {
        if (!BACKUP_NAME.test(source.name)) throw new InvalidBackupError('Invalid backup name.');
        const exists = (await this.target.list()).some((b) => b.name === source.name);
        if (!exists) throw new InvalidBackupError(`Backup "${source.name}" not found.`);
        await this.target.download(source.name, candidate);
        label = source.name;
      } else {
        await fsp.copyFile(source.file, candidate);
        label = source.label;
      }

      validateDatabaseFile(candidate);

      const safety = await this.run('pre-restore');
      await this.copyOverLive(candidate);
      ensureRuntimeTables();

      this.log.info(`[backup] restored ${label} (safety backup: ${safety.name})`);
      return { restoredFrom: label, safetyBackup: safety.name };
    } finally {
      this.restoring = false;
      await fsp.rm(candidate, { force: true });
    }
  }

  private restoring = false;

  private async copyOverLive(candidate: string, attempts = 5, delayMs = 2_000) {
    const source = new Database(candidate, { readonly: true, fileMustExist: true });
    try {
      for (let i = 1; ; i++) {
        try {
          await source.backup(path.resolve(env.DATABASE_URL));
          return;
        } catch (e) {
          const code = (e as { code?: string }).code ?? '';
          if (!/BUSY|LOCKED/.test(code) || i >= attempts) throw e;
          await new Promise((r) => setTimeout(r, delayMs * i));
        }
      }
    } finally {
      source.close();
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

/** Throws InvalidBackupError unless the file is a healthy Picho-RPG SQLite database. */
export function validateDatabaseFile(filePath: string) {
  const header = Buffer.alloc(16);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, header, 0, 16, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (header.subarray(0, 15).toString('latin1') !== 'SQLite format 3' || header[15] !== 0) {
    throw new InvalidBackupError('Not a SQLite database file.');
  }

  let db: Database.Database | undefined;
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true });
    const integrity = db.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok')
      throw new InvalidBackupError(`Integrity check failed: ${String(integrity)}`);
    const tables = new Set(
      (
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
          name: string;
        }[]
      ).map((r) => r.name),
    );
    const missing = CORE_TABLES.filter((t) => !tables.has(t));
    if (missing.length)
      throw new InvalidBackupError(`Not a Picho-RPG database (missing: ${missing.join(', ')}).`);
  } catch (e) {
    if (e instanceof InvalidBackupError) throw e;
    throw new InvalidBackupError(`Unreadable database: ${(e as Error).message}`);
  } finally {
    db?.close();
  }
}

export const sqliteBackup = new SqliteBackupService();
