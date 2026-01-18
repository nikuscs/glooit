import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { BackupManager } from '../../src/core/backup';
import type { Config } from '../../src/types';

const testDir = 'test-backup-nested';

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
  process.chdir(testDir);
});

afterEach(() => {
  process.chdir('..');
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe('BackupManager restore nested paths', () => {
  it('creates nested directories on restore', async () => {
    const config: Config = { rules: [], configDir: '.agents', backup: { enabled: true, retention: 10 } };
    const manager = new BackupManager(config);

    mkdirSync('nested', { recursive: true });
    writeFileSync('nested/file.md', '# Test');
    const ts = await manager.createBackup(['nested/file.md']);

    rmSync('nested', { recursive: true, force: true });
    await manager.restoreBackup(ts);

    expect(existsSync('nested/file.md')).toBe(true);
  });
});
