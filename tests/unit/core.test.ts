import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { AIRulesCore } from '../../src/core';
import type { Config } from '../../src/types';

describe('AIRulesCore', () => {
  const testDir = '/tmp/test-core-' + Date.now();
  const originalCwd = process.cwd();

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('sync with hooks', () => {
    it('should execute before hooks', async () => {
      const beforeHookExecuted = vi.fn();

      const config: Config = {
        configDir: '.ai-rules',
        rules: [{
          file: 'test.md',
          to: './',
          targets: ['claude']
        }],
        mergeMcps: true,
        hooks: {
          before: [beforeHookExecuted]
        }
      };

      writeFileSync('test.md', '# Test content');

      const core = new AIRulesCore(config);
      await core.sync();

      expect(beforeHookExecuted).toHaveBeenCalledWith({ config });
    });

    it('should execute after hooks on rule content', async () => {
      const afterHook = vi.fn((context) => {
        return context.content + '\n\n<!-- Hook executed -->';
      });

      const config: Config = {
        configDir: '.ai-rules',
        rules: [{
          file: 'test.md',
          to: './',
          targets: ['claude']
        }],
        mergeMcps: true,
        hooks: {
          after: [afterHook]
        }
      };

      writeFileSync('test.md', '# Test content');

      const core = new AIRulesCore(config);
      await core.sync();

      expect(afterHook).toHaveBeenCalled();

      // Check that the hook modified the content
      const generatedContent = readFileSync('CLAUDE.md', 'utf-8');
      expect(generatedContent).toContain('<!-- Hook executed -->');
    });

    it('should execute built-in hooks', async () => {
      const config: Config = {
        configDir: '.ai-rules',
        rules: [{
          file: 'test.md',
          to: './',
          targets: ['claude'],
          hooks: ['addTimestamp', 'replaceEnv']
        }],
        mergeMcps: true
      };

      // Set environment variable for testing
      process.env.TEST_VAR = 'test-value';

      writeFileSync('test.md', '# Test content\n\nGenerated: __TIMESTAMP__\nDB: __ENV_TEST_VAR__');

      const core = new AIRulesCore(config);
      await core.sync();

      const generatedContent = readFileSync('CLAUDE.md', 'utf-8');
      expect(generatedContent).toContain('Generated:');
      expect(generatedContent).toContain('DB: test-value');
      expect(generatedContent).not.toContain('__TIMESTAMP__');
      expect(generatedContent).not.toContain('__ENV_TEST_VAR__');

      // Cleanup
      delete process.env.TEST_VAR;
    });

    it('should handle error hooks on failure', async () => {
      const errorHook = vi.fn();

      const config: Config = {
        configDir: '.ai-rules',
        rules: [{
          file: 'nonexistent.md', // This will cause an error
          to: './',
          targets: ['claude']
        }],
        mergeMcps: true,
        hooks: {
          error: [errorHook]
        }
      };

      const core = new AIRulesCore(config);

      try {
        await core.sync();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(errorHook).toHaveBeenCalledWith(error);
      }
    });
  });

  describe('MCP configuration', () => {
    it('should generate MCP configuration files', async () => {
      const config: Config = {
        configDir: '.ai-rules',
        rules: [],
        mergeMcps: true,
        mcps: [
          {
            name: 'postgres',
            config: {
              command: 'npx',
              args: ['pg-mcp-server'],
              env: { DATABASE_URL: 'postgresql://localhost/test' },
              type: 'stdio'
            },
            targets: ['claude'],
            outputPath: '.mcp.json'
          },
          {
            name: 'redis',
            config: {
              command: 'redis-cli',
              type: 'stdio'
            },
            targets: ['claude']
          }
        ]
      };

      const core = new AIRulesCore(config);
      await core.sync();

      // Check custom output path
      expect(existsSync('.mcp.json')).toBe(true);
      const mcpConfig = JSON.parse(readFileSync('.mcp.json', 'utf-8'));

      expect(mcpConfig.mcpServers).toBeDefined();
      expect(mcpConfig.mcpServers.postgres).toEqual({
        command: 'npx',
        args: ['pg-mcp-server'],
        env: { DATABASE_URL: 'postgresql://localhost/test' },
        type: 'stdio'
      });

      expect(mcpConfig.mcpServers.redis).toEqual({
        command: 'redis-cli',
        type: 'stdio'
      });
    });

    it('should merge with existing MCP configuration', async () => {
      // Create existing config
      const existingConfig = {
        mcpServers: {
          existing: {
            command: 'existing-server'
          }
        },
        otherSettings: {
          someValue: 'preserved'
        }
      };
      writeFileSync('.mcp.json', JSON.stringify(existingConfig, null, 2));

      const config: Config = {
        configDir: '.ai-rules',
        rules: [],
        mergeMcps: true,
        mcps: [{
          name: 'new-server',
          config: {
            command: 'new-command'
          },
          targets: ['claude'],
          outputPath: '.mcp.json'
        }]
      };

      const core = new AIRulesCore(config);
      await core.sync();

      const mcpConfig = JSON.parse(readFileSync('.mcp.json', 'utf-8'));

      // Should preserve existing config
      expect(mcpConfig.mcpServers.existing).toEqual({ command: 'existing-server' });
      expect(mcpConfig.otherSettings).toEqual({ someValue: 'preserved' });

      // Should add new config
      expect(mcpConfig.mcpServers['new-server']).toEqual({ command: 'new-command' });
    });
  });

  describe('backup functionality', () => {
    it('should create backups when enabled', async () => {
      const config: Config = {
        configDir: '.ai-rules',
        rules: [{
          file: 'test.md',
          to: './',
          targets: ['claude']
        }],
        mergeMcps: true,
        backup: {
          enabled: true,
          retention: 5
        }
      };

      writeFileSync('test.md', '# Test content');

      // First sync to create files to backup
      const core = new AIRulesCore(config);
      await core.sync();

      // Now create backup
      const backupId = await core.createBackup();

      expect(backupId).toBeTruthy();
      expect(existsSync('.ai-rules/backups')).toBe(true);
    });

    it('should skip backups when disabled', async () => {
      const config: Config = {
        configDir: '.ai-rules',
        rules: [],
        mergeMcps: true,
        backup: {
          enabled: false,
          retention: 5
        }
      };

      const core = new AIRulesCore(config);
      const backupId = await core.createBackup();

      expect(backupId).toBe('');
    });

    it('should list backups correctly', async () => {
      const config: Config = {
        configDir: '.ai-rules',
        rules: [{
          file: 'test.md',
          to: './',
          targets: ['claude']
        }],
        mergeMcps: true
      };

      writeFileSync('test.md', '# Test content');

      const core = new AIRulesCore(config);

      // Initially no backups
      let backups = core.listBackups();
      expect(backups).toHaveLength(0);

      // Sync to create files
      await core.sync();

      // Verify CLAUDE.md was created
      expect(existsSync('CLAUDE.md')).toBe(true);

      // Manually create backup with known files
      const backupManager = (core as any).backupManager;
      const backupId = await backupManager.createBackup(['CLAUDE.md']);

      expect(backupId).toBeTruthy();

      // Should have one backup
      backups = core.listBackups();
      expect(backups.length).toBeGreaterThan(0);
      expect(backups[0]).toHaveProperty('timestamp');
      expect(backups[0]).toHaveProperty('fileCount');
    });
  });

  describe('validation', () => {
    it('should validate successfully with all files present', async () => {
      const config: Config = {
        configDir: '.ai-rules',
        rules: [{
          file: 'test.md',
          to: './',
          targets: ['claude']
        }],
        mergeMcps: true,
        commands: [{
          command: 'build',
          file: 'build.md',
          targets: ['cursor']
        }]
      };

      writeFileSync('test.md', '# Test content');
      writeFileSync('build.md', '# Build command');

      const core = new AIRulesCore(config);
      const isValid = await core.validate();

      expect(isValid).toBe(true);
    });

    it('should fail validation with missing files', async () => {
      const config: Config = {
        configDir: '.ai-rules',
        rules: [{
          file: 'missing.md',
          to: './',
          targets: ['claude']
        }],
        mergeMcps: true
      };

      const core = new AIRulesCore(config);
      const isValid = await core.validate();

      expect(isValid).toBe(false);
    });
  });
});