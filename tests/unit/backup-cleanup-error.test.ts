import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';

let throwExists = false;

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: (...args: Parameters<typeof actual.existsSync>) => {
      if (throwExists) {
        throw new Error('boom');
      }
      return actual.existsSync(...args);
    }
  };
});

describe('BackupManager cleanup error handling', () => {
  const testDir = 'test-backup-cleanup-error';

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

  it('swallows errors when deletion checks fail', async () => {
    const { BackupManager } = await import('../../src/core/backup');

    const manager = new BackupManager({ rules: [], configDir: '.agents', backup: { retention: -1 } });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    (manager as unknown as { logCleanupError: (timestamp: string, error: unknown) => void })
      .logCleanupError('bad-backup', new Error('boom'));

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('handles errors when existsSync throws during cleanup', async () => {
    vi.resetModules();
    const { BackupManager } = await import('../../src/core/backup');
    const manager = new BackupManager({ rules: [], configDir: '.agents', backup: { retention: -1 } });
    (manager as unknown as { listBackups: () => { timestamp: string; fileCount: number }[] }).listBackups = () => [
      { timestamp: 'forced', fileCount: 1 }
    ];

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    throwExists = true;

    await (manager as unknown as { cleanupOldBackups: () => Promise<void> }).cleanupOldBackups();

    throwExists = false;
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
