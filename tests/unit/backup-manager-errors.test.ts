import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import * as fs from 'fs';
import { BackupManager } from '../../src/core/backup';
import type { Config } from '../../src/types';

const testDir = 'test-backup-errors';

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

describe('BackupManager error branches', () => {
  it('warns for missing file and returns empty timestamp', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config: Config = { rules: [], configDir: '.agents', backup: { enabled: true, retention: 10 } };
    const manager = new BackupManager(config);

    const result = await manager.createBackup(['missing.md']);
    expect(result).toBe('');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('handles invalid backup JSON when listing', async () => {
    const config: Config = { rules: [], configDir: '.agents', backup: { enabled: true, retention: 10 } };
    const manager = new BackupManager(config);

    mkdirSync('.agents/backups', { recursive: true });
    writeFileSync('.agents/backups/bad.json', '{ invalid');

    const list = manager.listBackups();
    expect(list[0]?.fileCount).toBe(0);
  });

  it('throws when backup JSON is invalid on restore', async () => {
    const config: Config = { rules: [], configDir: '.agents', backup: { enabled: true, retention: 10 } };
    const manager = new BackupManager(config);

    mkdirSync('.agents/backups', { recursive: true });
    writeFileSync('.agents/backups/bad.json', '{ invalid');

    await expect(manager.restoreBackup('bad')).rejects.toThrow('Failed to restore backup');
  });

  // Cleanup error path is exercised in integration tests via log output
});
