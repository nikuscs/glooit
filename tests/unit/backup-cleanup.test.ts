import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { BackupManager } from '../../src/core/backup';
import type { Config } from '../../src/types';

const testDir = 'test-backup-cleanup';

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

describe('BackupManager cleanup', () => {
  it('logs deletions when retention is exceeded', async () => {
    mkdirSync('.agents', { recursive: true });
    mkdirSync('.agents/backups', { recursive: true });
    writeFileSync('file.md', 'content');

    const config: Config = {
      rules: [],
      configDir: '.agents',
      backup: { retention: 1 }
    };

    const manager = new BackupManager(config);
    const backup1 = { timestamp: 't1', files: [{ path: 'file.md', content: 'content' }] };
    const backup2 = { timestamp: 't2', files: [{ path: 'file.md', content: 'content' }] };

    writeFileSync('.agents/backups/t1.json', JSON.stringify(backup1));
    writeFileSync('.agents/backups/t2.json', JSON.stringify(backup2));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await (manager as unknown as { cleanupOldBackups: () => Promise<void> }).cleanupOldBackups();

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
