import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { BackupManager } from '../../src/core/backup';
import type { Config } from '../../src/types';

const testDir = 'test-backup';

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

describe('BackupManager', () => {
  const config: Config = { rules: [], configDir: '.agents', backup: { enabled: true, retention: 10 } };

  it('creates and lists backups', async () => {
    const manager = new BackupManager(config);

    writeFileSync('CLAUDE.md', '# Test');

    const timestamp = await manager.createBackup(['CLAUDE.md']);
    expect(timestamp).toBeTruthy();

    const backups = manager.listBackups();
    expect(backups.length).toBeGreaterThan(0);
  });

  it('restores backup content', async () => {
    const manager = new BackupManager(config);

    writeFileSync('CLAUDE.md', '# Test');
    const timestamp = await manager.createBackup(['CLAUDE.md']);

    writeFileSync('CLAUDE.md', '# Changed');
    await manager.restoreBackup(timestamp);
    const content = readFileSync('CLAUDE.md', 'utf-8');
    expect(content).toContain('# Test');
  });

  it('throws when backup is missing', async () => {
    const manager = new BackupManager(config);
    await expect(manager.restoreBackup('missing')).rejects.toThrow('Backup missing not found');
  });

  it('returns empty list when backup dir is missing', () => {
    const manager = new BackupManager(config);
    const backups = manager.listBackups();
    expect(backups).toEqual([]);
  });

  it('runs cleanup when backups exceed retention', async () => {
    const localConfig: Config = { rules: [], configDir: '.agents', backup: { enabled: true, retention: 1 } };
    const manager = new BackupManager(localConfig);

    writeFileSync('A.md', 'A');
    writeFileSync('B.md', 'B');

    await manager.createBackup(['A.md']);
    await manager.createBackup(['B.md']);

    const backups = manager.listBackups();
    expect(backups.length).toBeGreaterThan(0);
  });
});
