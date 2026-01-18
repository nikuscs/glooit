import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { AIRulesCore } from '../../src/core';
import { AgentHooksDistributor } from '../../src/agents/hooks-distributor';
import { BackupManager } from '../../src/core/backup';
import type { Config } from '../../src/types';

const testDir = 'test-core-hooks';

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
  process.chdir(testDir);
  mkdirSync('.agents', { recursive: true });
  writeFileSync('.agents/main.md', '# Main');
});

afterEach(() => {
  process.chdir('..');
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe('AIRulesCore hooks and restore coverage', () => {
  it('invokes hooks distributor during sync when hooks are configured', async () => {
    const hooksSpy = vi.spyOn(AgentHooksDistributor.prototype, 'distributeHooks').mockResolvedValue(undefined);

    const config: Config = {
      rules: [{ file: '.agents/main.md', to: './', targets: ['claude'] }],
      hooks: [{ event: 'Stop', targets: ['claude'], command: 'echo ok' }]
    };

    const core = new AIRulesCore(config);
    await core.sync();

    expect(hooksSpy).toHaveBeenCalled();

    hooksSpy.mockRestore();
  });

  it('delegates restoreBackup to BackupManager', async () => {
    const restoreSpy = vi.spyOn(BackupManager.prototype, 'restoreBackup').mockResolvedValue(true);

    const config: Config = {
      rules: [{ file: '.agents/main.md', to: './', targets: ['claude'] }]
    };

    const core = new AIRulesCore(config);
    await core.restoreBackup('fake-timestamp');

    expect(restoreSpy).toHaveBeenCalledWith('fake-timestamp');

    restoreSpy.mockRestore();
  });
});
