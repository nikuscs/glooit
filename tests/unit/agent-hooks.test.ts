import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { AgentHooksDistributor } from '../../src/agents/hooks-distributor';
import type { Config } from '../../src/types';

describe('AgentHooksDistributor', () => {
  const testDir = 'test-agent-hooks';

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir('..');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('Claude Code hooks', () => {
    it('should generate .claude/settings.json with hooks', async () => {
      const config: Config = {
        rules: [],
        hooks: [
          {
            event: 'PostToolUse',
            command: 'npx prettier --write',
            matcher: 'Edit|Write',
            targets: ['claude']
          }
        ]
      };

      const distributor = new AgentHooksDistributor(config);
      await distributor.distributeHooks();

      expect(existsSync('.claude/settings.json')).toBe(true);

      const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf-8'));
      expect(settings.hooks).toBeDefined();
      expect(settings.hooks.PostToolUse).toBeDefined();
      expect(settings.hooks.PostToolUse[0].matcher).toBe('Edit|Write');
      expect(settings.hooks.PostToolUse[0].hooks[0].command).toBe('npx prettier --write');
    });

    it('should use bun for .ts scripts', async () => {
      const config: Config = {
        rules: [],
        hooks: [
          {
            event: 'PreToolUse',
            script: '.glooit/hooks/check.ts',
            targets: ['claude']
          }
        ]
      };

      const distributor = new AgentHooksDistributor(config);
      await distributor.distributeHooks();

      const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf-8'));
      expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe('bun run .glooit/hooks/check.ts');
    });

    it('should use node for .js scripts', async () => {
      const config: Config = {
        rules: [],
        hooks: [
          {
            event: 'PostToolUse',
            script: '.glooit/hooks/format.js',
            targets: ['claude']
          }
        ]
      };

      const distributor = new AgentHooksDistributor(config);
      await distributor.distributeHooks();

      const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf-8'));
      expect(settings.hooks.PostToolUse[0].hooks[0].command).toBe('node .glooit/hooks/format.js');
    });

    it('should map Cursor events to Claude equivalents', async () => {
      const config: Config = {
        rules: [],
        hooks: [
          {
            event: 'afterFileEdit',
            command: 'npx eslint --fix',
            targets: ['claude']
          }
        ]
      };

      const distributor = new AgentHooksDistributor(config);
      await distributor.distributeHooks();

      const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf-8'));
      // afterFileEdit should map to PostToolUse for Claude
      expect(settings.hooks.PostToolUse).toBeDefined();
      expect(settings.hooks.PostToolUse[0].matcher).toBe('Edit|Write');
    });

    it('should group multiple hooks under same matcher', async () => {
      const config: Config = {
        rules: [],
        hooks: [
          {
            event: 'PostToolUse',
            command: 'npx prettier --write',
            matcher: 'Edit',
            targets: ['claude']
          },
          {
            event: 'PostToolUse',
            command: 'npx eslint --fix',
            matcher: 'Edit',
            targets: ['claude']
          }
        ]
      };

      const distributor = new AgentHooksDistributor(config);
      await distributor.distributeHooks();

      const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf-8'));
      expect(settings.hooks.PostToolUse).toHaveLength(1);
      expect(settings.hooks.PostToolUse[0].hooks).toHaveLength(2);
    });
  });

  describe('Cursor hooks', () => {
    it('should generate .cursor/hooks.json with hooks', async () => {
      const config: Config = {
        rules: [],
        hooks: [
          {
            event: 'afterFileEdit',
            command: 'npx prettier --write',
            targets: ['cursor']
          }
        ]
      };

      const distributor = new AgentHooksDistributor(config);
      await distributor.distributeHooks();

      expect(existsSync('.cursor/hooks.json')).toBe(true);

      const hooksConfig = JSON.parse(readFileSync('.cursor/hooks.json', 'utf-8'));
      expect(hooksConfig.version).toBe(1);
      expect(hooksConfig.hooks.afterFileEdit).toBeDefined();
      expect(hooksConfig.hooks.afterFileEdit[0].command).toBe('npx prettier --write');
    });

    it('should map Claude events to Cursor equivalents', async () => {
      const config: Config = {
        rules: [],
        hooks: [
          {
            event: 'PostToolUse',
            command: 'npx eslint --fix',
            targets: ['cursor']
          }
        ]
      };

      const distributor = new AgentHooksDistributor(config);
      await distributor.distributeHooks();

      const hooksConfig = JSON.parse(readFileSync('.cursor/hooks.json', 'utf-8'));
      // PostToolUse should map to afterFileEdit for Cursor
      expect(hooksConfig.hooks.afterFileEdit).toBeDefined();
    });

    it('should use bun for .ts scripts in Cursor', async () => {
      const config: Config = {
        rules: [],
        hooks: [
          {
            event: 'beforeShellExecution',
            script: '.glooit/hooks/validate.ts',
            targets: ['cursor']
          }
        ]
      };

      const distributor = new AgentHooksDistributor(config);
      await distributor.distributeHooks();

      const hooksConfig = JSON.parse(readFileSync('.cursor/hooks.json', 'utf-8'));
      expect(hooksConfig.hooks.beforeShellExecution[0].command).toBe('bun run .glooit/hooks/validate.ts');
    });
  });

  describe('Multi-agent hooks', () => {
    it('should generate hooks for both Claude and Cursor', async () => {
      const config: Config = {
        rules: [],
        hooks: [
          {
            event: 'afterFileEdit',
            command: 'npx prettier --write',
            targets: ['claude', 'cursor']
          }
        ]
      };

      const distributor = new AgentHooksDistributor(config);
      await distributor.distributeHooks();

      expect(existsSync('.claude/settings.json')).toBe(true);
      expect(existsSync('.cursor/hooks.json')).toBe(true);

      const claudeSettings = JSON.parse(readFileSync('.claude/settings.json', 'utf-8'));
      const cursorHooks = JSON.parse(readFileSync('.cursor/hooks.json', 'utf-8'));

      expect(claudeSettings.hooks.PostToolUse).toBeDefined();
      expect(cursorHooks.hooks.afterFileEdit).toBeDefined();
    });
  });

  describe('getGeneratedPaths', () => {
    it('should return empty array when no hooks defined', () => {
      const config: Config = { rules: [] };
      const distributor = new AgentHooksDistributor(config);
      expect(distributor.getGeneratedPaths()).toEqual([]);
    });

    it('should return Claude settings path when Claude hooks defined', () => {
      const config: Config = {
        rules: [],
        hooks: [
          { event: 'PostToolUse', command: 'echo test', targets: ['claude'] }
        ]
      };
      const distributor = new AgentHooksDistributor(config);
      expect(distributor.getGeneratedPaths()).toContain('.claude/settings.json');
    });

    it('should return Cursor hooks path when Cursor hooks defined', () => {
      const config: Config = {
        rules: [],
        hooks: [
          { event: 'afterFileEdit', command: 'echo test', targets: ['cursor'] }
        ]
      };
      const distributor = new AgentHooksDistributor(config);
      expect(distributor.getGeneratedPaths()).toContain('.cursor/hooks.json');
    });

    it('should return both paths when hooks for both defined', () => {
      const config: Config = {
        rules: [],
        hooks: [
          { event: 'afterFileEdit', command: 'echo test', targets: ['claude', 'cursor'] }
        ]
      };
      const distributor = new AgentHooksDistributor(config);
      const paths = distributor.getGeneratedPaths();
      expect(paths).toContain('.claude/settings.json');
      expect(paths).toContain('.cursor/hooks.json');
    });
  });

  describe('No hooks', () => {
    it('should do nothing when no hooks defined', async () => {
      const config: Config = { rules: [] };
      const distributor = new AgentHooksDistributor(config);
      await distributor.distributeHooks();

      expect(existsSync('.claude/settings.json')).toBe(false);
      expect(existsSync('.cursor/hooks.json')).toBe(false);
    });

    it('should do nothing when hooks is empty array', async () => {
      const config: Config = { rules: [], hooks: [] };
      const distributor = new AgentHooksDistributor(config);
      await distributor.distributeHooks();

      expect(existsSync('.claude/settings.json')).toBe(false);
      expect(existsSync('.cursor/hooks.json')).toBe(false);
    });
  });
});
