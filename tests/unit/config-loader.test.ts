import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { ConfigLoader } from '../../src/core/config-loader';

describe('ConfigLoader', () => {
  const testConfigPath = 'test-config.js';

  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
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

  describe('validate', () => {
    it('should return false for non-existent config file', async () => {
      const isValid = await ConfigLoader.validate('non-existent-config.ts');
      expect(isValid).toBe(false);
    });

    it('should return true for valid config file', async () => {
      const validConfig = `
        export default {
          rules: [{
            file: '.glooit/test.md',
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
            file: ['.glooit/part1.md', '.glooit/part2.md'],
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
            file: ['.glooit/part1.md', '.glooit/part2.md'],
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
            file: ['.glooit/part1.md', '.glooit/part2.md'],
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
  });
});