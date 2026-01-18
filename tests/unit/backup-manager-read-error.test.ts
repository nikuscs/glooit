import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const testDir = 'test-backup-read-error';

describe('BackupManager read error path', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unmock('fs');
  });

  it('warns when readFileSync fails during backup', async () => {
    vi.mock('fs', () => {
      const actual = require('fs');
      return {
        ...actual,
        readFileSync: () => { throw new Error('read fail'); }
      };
    });

    const { BackupManager } = await import('../../src/core/backup');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { writeFileSync, rmSync, existsSync } = require('fs');
    writeFileSync('exists.md', 'content');

    const manager = new BackupManager({ rules: [], configDir: '.agents', backup: { enabled: true, retention: 10 } });
    const ts = await manager.createBackup(['exists.md']);
    expect(ts).toBe('');
    expect(warnSpy).toHaveBeenCalled();

    if (existsSync('exists.md')) rmSync('exists.md', { force: true });
    warnSpy.mockRestore();
  });
});
