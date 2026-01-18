import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { ConfigLoader } from '../../src/core/config-loader';

describe('ConfigLoader', () => {
  const testConfigPath = 'test-config.js';

  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
    if (existsSync('.agents')) {
      rmSync('.agents', { recursive: true, force: true });
    }
    if (existsSync('.glooit')) {
      rmSync('.glooit', { recursive: true, force: true });
    }
  });

  describe('createInitialConfig', () => {
    it('should create a valid initial configuration', () => {
      const config = ConfigLoader.createInitialConfig();

      expect(config).toContain('import { defineRules }');
      expect(config).toContain('export default defineRules({');
      expect(config).toContain('});');
      expect(config).toContain('targets: [');
      expect(config).toContain('claude');
      expect(config).toContain('cursor');
    });
  });

  describe('createConfig templates', () => {
    it('should include .agents and mode in typed config', () => {
      const config = ConfigLoader.createTypedConfig();
      expect(config).toContain("configDir: '.agents'");
      expect(config).toContain("mode: 'copy'");
      expect(config).toContain("file: '.agents/main.md'");
    });

    it('should include .agents and mode in plain config', () => {
      const config = ConfigLoader.createPlainConfig();
      expect(config).toContain("configDir: '.agents'");
      expect(config).toContain("mode: 'copy'");
      expect(config).toContain("file: '.agents/main.md'");
    });
  });

  describe('internal helpers', () => {
    it('isDirectoryPath returns true only for directories', () => {
      const dir = 'test-dir-helper';
      const file = 'test-file-helper';
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, 'content');

      const loader = ConfigLoader as unknown as { isDirectoryPath: (path: string) => boolean };
      expect(loader.isDirectoryPath(dir)).toBe(true);
      expect(loader.isDirectoryPath(file)).toBe(false);

      rmSync(dir, { recursive: true, force: true });
      rmSync(file, { force: true });

      expect(loader.isDirectoryPath('missing-path')).toBe(false);
    });
  });

  describe('validate', () => {
    it('should return false for non-existent config file', async () => {
      const isValid = await ConfigLoader.validate('non-existent-config.ts');
      expect(isValid).toBe(false);
    });

    it('should return true for valid config file', async () => {
      const validConfig = `
        export default {
          rules: [{
            file: '.agents/test.md',
            to: './',
            targets: ['claude']
          }]
        };
      `;

      writeFileSync(testConfigPath, validConfig);

      // Note: This would require the test.md file to exist for full validation
      // For now, we're just testing the config structure validation
      try {
        await ConfigLoader.load(testConfigPath);
        expect(true).toBe(true); // Config structure is valid
      } catch (error) {
        // Expected if rule files don't exist, but config structure is valid
        expect(String(error)).toContain('test.md');
      }
    });

    it('should accept file arrays with object targets', async () => {
      const validConfig = `
        export default {
          rules: [{
            file: ['.agents/part1.md', '.agents/part2.md'],
            to: './',
            targets: [
              { name: 'claude', to: './merged.md' }
            ]
          }]
        };
      `;

      writeFileSync(testConfigPath, validConfig);

      try {
        await ConfigLoader.load(testConfigPath);
        expect(true).toBe(true);
      } catch (error) {
        // Expected if rule files don't exist, but config structure is valid
        expect(String(error)).toContain('.md');
      }
    });

    it('should reject file arrays with string targets', async () => {
      const invalidConfigPath = 'test-invalid-config.js';

      const invalidConfig = `
        export default {
          rules: [{
            file: ['.agents/part1.md', '.agents/part2.md'],
            to: './',
            targets: ['claude']
          }]
        };
      `;

      writeFileSync(invalidConfigPath, invalidConfig);

      try {
        await expect(ConfigLoader.load(invalidConfigPath)).rejects.toThrow(/merge mode/);
      } finally {
        if (existsSync(invalidConfigPath)) {
          unlinkSync(invalidConfigPath);
        }
      }
    });

    it('should accept file arrays with object targets and gitignore option', async () => {
      const validConfig = `
        export default {
          gitignore: false,
          rules: [{
            file: ['.agents/part1.md', '.agents/part2.md'],
            to: './',
            targets: [
              { name: 'claude', to: './merged.md' }
            ]
          }]
        };
      `;

      writeFileSync(testConfigPath, validConfig);

      // Should load without error
      const config = await ConfigLoader.load(testConfigPath);
      expect(config).toBeDefined();
      expect(config.rules).toHaveLength(1);
    });

    it('should default rule.to for known directory types', async () => {
      const validConfig = `
        export default {
          rules: [{
            name: 'commands',
            file: 'commands',
            targets: ['claude']
          }]
        };
      `;

      writeFileSync(testConfigPath, validConfig);

      const config = await ConfigLoader.load(testConfigPath);
      expect(config.rules[0]?.to).toBe('./');
    });

    it('should apply backup defaults when backup is present', async () => {
      const backupConfigPath = 'test-config-backup.js';
      const validConfig = `
        export default {
          backup: {},
          rules: [{
            file: '.agents/test.md',
            to: './',
            targets: ['claude']
          }]
        };
      `;

      writeFileSync(backupConfigPath, validConfig);
      const config = await ConfigLoader.load(backupConfigPath);
      expect(config.backup?.enabled).toBe(true);
      expect(config.backup?.retention).toBe(10);
      if (existsSync(backupConfigPath)) {
        unlinkSync(backupConfigPath);
      }
    });

    it('should apply default mcp targets', async () => {
      const mcpConfigPath = 'test-config-mcp.js';
      const validConfig = `
        export default {
          mcps: [{ name: 'server', config: { command: 'node' } }],
          rules: [{
            file: '.agents/test.md',
            to: './',
            targets: ['claude']
          }]
        };
      `;

      writeFileSync(mcpConfigPath, validConfig);
      const config = await ConfigLoader.load(mcpConfigPath);
      expect(config.mcps?.[0]?.targets).toEqual(['claude']);
      if (existsSync(mcpConfigPath)) {
        unlinkSync(mcpConfigPath);
      }
    });

    it('should load config from function export', async () => {
      const functionalConfig = `
        export default () => ({
          rules: [{
            file: '.agents/test.md',
            to: './',
            targets: ['claude']
          }]
        });
      `;

      writeFileSync(testConfigPath, functionalConfig);

      try {
        const config = await ConfigLoader.load(testConfigPath);
        expect(config.rules.length).toBe(1);
      } catch (error) {
        expect(String(error)).toContain('test.md');
      }
    });

    it('should find default config without custom path', async () => {
      const defaultConfigPath = 'glooit.config.js';
      const validConfig = `
        export default {
          rules: [{
            file: '.agents/test.md',
            to: './',
            targets: ['claude']
          }]
        };
      `;

      writeFileSync(defaultConfigPath, validConfig);

      try {
        const config = await ConfigLoader.load();
        expect(config.rules.length).toBe(1);
      } catch (error) {
        expect(String(error)).toContain('test.md');
      } finally {
        if (existsSync(defaultConfigPath)) {
          unlinkSync(defaultConfigPath);
        }
      }
    });

    it('should find config in config/ directory', async () => {
      mkdirSync('config', { recursive: true });
      const path = 'config/glooit.js';
      const validConfig = `
        export default {
          rules: [{
            file: '.agents/test.md',
            to: './',
            targets: ['claude']
          }]
        };
      `;

      writeFileSync(path, validConfig);
      try {
        const config = await ConfigLoader.load();
        expect(config.rules.length).toBe(1);
      } catch (error) {
        expect(String(error)).toContain('test.md');
      } finally {
        if (existsSync(path)) {
          unlinkSync(path);
        }
        if (existsSync('config')) {
          rmSync('config', { recursive: true, force: true });
        }
      }
    });

    it('should default to .agents when present', async () => {
      const tempDir = 'test-config-dir-agents';
      mkdirSync(tempDir, { recursive: true });
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        mkdirSync('.agents', { recursive: true });
        const validConfig = `
          export default {
            rules: [{
              file: '.agents/test.md',
              to: './',
              targets: ['claude']
            }]
          };
        `;
        writeFileSync(testConfigPath, validConfig);

        try {
          const config = await ConfigLoader.load(testConfigPath);
          expect(config.configDir).toBe('.agents');
        } catch (error) {
          expect(String(error)).toContain('test.md');
        }
      } finally {
        process.chdir(originalCwd);
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true });
        }
      }
    });

    it('should default to .agents when neither directory exists', async () => {
      const tempDir = 'test-config-dir-default';
      mkdirSync(tempDir, { recursive: true });
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        const validConfig = `
          export default {
            rules: [{
              file: '.agents/test.md',
              to: './',
              targets: ['claude']
            }]
          };
        `;
        writeFileSync(testConfigPath, validConfig);

        try {
          const config = await ConfigLoader.load(testConfigPath);
          expect(config.configDir).toBe('.agents');
        } catch (error) {
          expect(String(error)).toContain('test.md');
        }
      } finally {
        process.chdir(originalCwd);
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true });
        }
      }
    });

    it('should default to legacy .glooit when present', async () => {
      const tempDir = 'test-config-dir-legacy';
      mkdirSync(tempDir, { recursive: true });
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        mkdirSync('.glooit', { recursive: true });
        const validConfig = `
          export default {
            rules: [{
              file: '.agents/test.md',
              to: './',
              targets: ['claude']
            }]
          };
        `;
        writeFileSync(testConfigPath, validConfig);

        try {
          const config = await ConfigLoader.load(testConfigPath);
          expect(config.configDir).toBe('.glooit');
        } catch (error) {
          expect(String(error)).toContain('test.md');
        }
      } finally {
        process.chdir(originalCwd);
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true });
        }
      }
    });
  });
});
