import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { ConfigValidator } from '../../src/core/validation';
import type { Config } from '../../src/types';

describe('ConfigValidator', () => {
  const testDir = 'test-validation';
  const testFile = `${testDir}/test.md`;

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('validate', () => {
    it('should return no errors for valid configuration', async () => {
      writeFileSync(testFile, '# Test rule');

      const config: Config = {
        configDir: '.ai-rules',
        rules: [{
          file: testFile,
          to: './',
          targets: ['claude'],
          globs: '**/*'
        }]
      };

      const errors = await ConfigValidator.validate(config);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing rule files', async () => {
      const config: Config = {
        configDir: '.ai-rules',
        rules: [{
          file: 'non-existent-file.md',
          to: './',
          targets: ['claude']
        }]
      };

      const errors = await ConfigValidator.validate(config);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('rules[0].file');
      expect(errors[0]?.message).toContain('not found');
      expect(errors[0]?.path).toBe('non-existent-file.md');
    });

    it('should detect empty targets array', async () => {
      writeFileSync(testFile, '# Test rule');

      const config: Config = {
        configDir: '.ai-rules',
        rules: [{
          file: testFile,
          to: './',
          targets: []
        }]
      };

      const errors = await ConfigValidator.validate(config);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('rules[0].targets');
      expect(errors[0]?.message).toContain('At least one target');
    });

    it('should detect invalid path formats', async () => {
      writeFileSync(testFile, '# Test rule');

      const config: Config = {
        configDir: '.ai-rules',
        rules: [{
          file: testFile,
          to: 'invalid-path',
          targets: ['claude']
        }]
      };

      const errors = await ConfigValidator.validate(config);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('rules[0].to');
      expect(errors[0]?.message).toContain('Invalid path format');
    });

    it('should validate commands', async () => {
      writeFileSync(testFile, '# Test command');

      const config: Config = {
        configDir: '.ai-rules',
        rules: [],
        commands: [{
          command: 'test',
          file: testFile,
          targets: ['claude']
        }]
      };

      const errors = await ConfigValidator.validate(config);
      expect(errors).toHaveLength(0);
    });
  });

  describe('formatErrors', () => {
    it('should format validation errors correctly', () => {
      const errors = [
        {
          field: 'rules[0].file',
          message: 'File not found',
          path: 'test.md'
        },
        {
          field: 'rules[0].targets',
          message: 'At least one target required'
        }
      ];

      const formatted = ConfigValidator.formatErrors(errors);

      expect(formatted).toContain('Configuration validation failed');
      expect(formatted).toContain('❌ rules[0].file: File not found');
      expect(formatted).toContain('File: test.md');
      expect(formatted).toContain('❌ rules[0].targets: At least one target required');
    });

    it('should return success message for no errors', () => {
      const formatted = ConfigValidator.formatErrors([]);
      expect(formatted).toBe('Configuration is valid');
    });
  });

  describe('hasErrors', () => {
    it('should return true when errors exist', () => {
      const errors = [{ field: 'test', message: 'error' }];
      expect(ConfigValidator.hasErrors(errors)).toBe(true);
    });

    it('should return false when no errors', () => {
      expect(ConfigValidator.hasErrors([])).toBe(false);
    });
  });
});