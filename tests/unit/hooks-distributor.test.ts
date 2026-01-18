import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { AgentHooksDistributor } from '../../src/agents/hooks-distributor';
import type { Config } from '../../src/types';

const testDir = 'test-hooks-distributor';

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

describe('AgentHooksDistributor', () => {
  it('writes Claude settings and Cursor hooks with mappings', async () => {
    const config: Config = {
      rules: [],
      hooks: [
        { event: 'beforeShellExecution', script: 'scripts/check.ts', targets: ['claude'] },
        { event: 'afterShellExecution', script: 'scripts/check.js', targets: ['cursor'] },
        { event: 'beforeReadFile', script: 'scripts/check.sh', targets: ['cursor'] }
      ]
    };

    const distributor = new AgentHooksDistributor(config);
    await distributor.distributeHooks();

    expect(existsSync('.claude/settings.json')).toBe(true);
    const claude = JSON.parse(readFileSync('.claude/settings.json', 'utf-8'));
    expect(claude.hooks.PreToolUse[0].hooks[0].command).toBe('bun run scripts/check.ts');

    expect(existsSync('.cursor/hooks.json')).toBe(true);
    const cursor = JSON.parse(readFileSync('.cursor/hooks.json', 'utf-8'));
    expect(cursor.hooks.afterShellExecution[0].command).toBe('node scripts/check.js');
    expect(cursor.hooks.beforeReadFile[0].command).toBe('scripts/check.sh');
  });

  it('skips unsupported events and handles invalid JSON', async () => {
    mkdirSync('.claude', { recursive: true });
    mkdirSync('.cursor', { recursive: true });
    writeFileSync('.claude/settings.json', '{ invalid json');
    writeFileSync('.cursor/hooks.json', '{ invalid json');

    const config: Config = {
      rules: [],
      hooks: [
        { event: 'beforeReadFile', command: 'echo skip', targets: ['claude'] },
        { event: 'UserPromptSubmit', command: 'echo ok', targets: ['claude'] },
        { event: 'UserPromptSubmit', command: 'echo cursor', targets: ['cursor'] }
      ]
    };

    const distributor = new AgentHooksDistributor(config);
    await distributor.distributeHooks();

    const claude = JSON.parse(readFileSync('.claude/settings.json', 'utf-8'));
    expect(claude.hooks.UserPromptSubmit[0].hooks[0].command).toBe('echo ok');
  });

  it('returns early when there are no hooks', async () => {
    const distributor = new AgentHooksDistributor({ rules: [], hooks: [] });
    await distributor.distributeHooks();
    expect(existsSync('.claude/settings.json')).toBe(false);
  });

  it('creates cursor hooks when config has no hooks field', async () => {
    mkdirSync('.cursor', { recursive: true });
    writeFileSync('.cursor/hooks.json', JSON.stringify({ version: 1 }, null, 2));

    const config: Config = {
      rules: [],
      hooks: [
        { event: 'afterShellExecution', command: 'echo ok', targets: ['cursor'] }
      ]
    };

    const distributor = new AgentHooksDistributor(config);
    await distributor.distributeHooks();

    const cursor = JSON.parse(readFileSync('.cursor/hooks.json', 'utf-8'));
    expect(cursor.hooks.afterShellExecution[0].command).toBe('echo ok');
  });

  it('appends hooks with same matcher for Claude', async () => {
    const config: Config = {
      rules: [],
      hooks: [
        { event: 'beforeShellExecution', command: 'echo one', matcher: 'Bash', targets: ['claude'] },
        { event: 'beforeShellExecution', command: 'echo two', matcher: 'Bash', targets: ['claude'] }
      ]
    };

    const distributor = new AgentHooksDistributor(config);
    await distributor.distributeHooks();

    const claude = JSON.parse(readFileSync('.claude/settings.json', 'utf-8'));
    expect(claude.hooks.PreToolUse[0].hooks.length).toBe(2);
  });

  it('throws when hook has no command or script', async () => {
    const config: Config = {
      rules: [],
      hooks: [
        { event: 'Stop', targets: ['claude'] }
      ]
    };

    const distributor = new AgentHooksDistributor(config);
    await expect(distributor.distributeHooks()).rejects.toThrow('Hook must have either');
  });

  it('getGeneratedPaths returns expected hook files', () => {
    const config: Config = {
      rules: [],
      hooks: [
        { event: 'Stop', command: 'echo ok', targets: ['claude'] },
        { event: 'afterFileEdit', command: 'echo ok', targets: ['cursor'] }
      ]
    };

    const distributor = new AgentHooksDistributor(config);
    const paths = distributor.getGeneratedPaths();
    expect(paths).toContain('.claude/settings.json');
    expect(paths).toContain('.cursor/hooks.json');
  });

  it('writes Factory hooks with same format as Claude', async () => {
    const config: Config = {
      rules: [],
      hooks: [
        { event: 'PreToolUse', command: 'echo pre', matcher: 'Bash', targets: ['factory'] },
        { event: 'PostToolUse', script: 'scripts/format.ts', targets: ['factory'] },
        { event: 'Stop', command: 'echo done', targets: ['factory'] }
      ]
    };

    const distributor = new AgentHooksDistributor(config);
    await distributor.distributeHooks();

    expect(existsSync('.factory/settings.json')).toBe(true);
    const factory = JSON.parse(readFileSync('.factory/settings.json', 'utf-8'));
    expect(factory.hooks.PreToolUse[0].matcher).toBe('Bash');
    expect(factory.hooks.PreToolUse[0].hooks[0].command).toBe('echo pre');
    expect(factory.hooks.PostToolUse[0].hooks[0].command).toBe('bun run scripts/format.ts');
    expect(factory.hooks.Stop[0].hooks[0].command).toBe('echo done');
  });

  it('skips unsupported events for Factory and handles invalid JSON', async () => {
    mkdirSync('.factory', { recursive: true });
    writeFileSync('.factory/settings.json', '{ invalid json');

    const config: Config = {
      rules: [],
      hooks: [
        { event: 'beforeReadFile', command: 'echo skip', targets: ['factory'] }, // Not supported
        { event: 'UserPromptSubmit', command: 'echo ok', targets: ['factory'] }
      ]
    };

    const distributor = new AgentHooksDistributor(config);
    await distributor.distributeHooks();

    const factory = JSON.parse(readFileSync('.factory/settings.json', 'utf-8'));
    expect(factory.hooks.UserPromptSubmit[0].hooks[0].command).toBe('echo ok');
  });

  it('appends hooks with same matcher for Factory', async () => {
    const config: Config = {
      rules: [],
      hooks: [
        { event: 'PreToolUse', command: 'echo one', matcher: 'Edit', targets: ['factory'] },
        { event: 'PreToolUse', command: 'echo two', matcher: 'Edit', targets: ['factory'] }
      ]
    };

    const distributor = new AgentHooksDistributor(config);
    await distributor.distributeHooks();

    const factory = JSON.parse(readFileSync('.factory/settings.json', 'utf-8'));
    expect(factory.hooks.PreToolUse[0].hooks.length).toBe(2);
  });

  it('getGeneratedPaths includes Factory when targeted', () => {
    const config: Config = {
      rules: [],
      hooks: [
        { event: 'Stop', command: 'echo ok', targets: ['factory'] }
      ]
    };

    const distributor = new AgentHooksDistributor(config);
    const paths = distributor.getGeneratedPaths();
    expect(paths).toContain('.factory/settings.json');
  });
});
