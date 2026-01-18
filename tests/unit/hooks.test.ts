import { describe, it, expect } from 'vitest';
import type { SyncContext } from '../../src/types';

describe('Built-in Hooks', () => {
  const mockContext: SyncContext = {
    config: {
      configDir: '.agents',
      rules: [],
      mergeMcps: true
    },
    rule: {
      file: 'test.md',
      to: './',
      targets: ['claude']
    },
    content: 'Test content',
    targetPath: './test.md',
    agent: 'claude'
  };

  describe('replaceEnv', () => {

    it('should replace environment variables', async () => {
      // Set a test environment variable
      process.env.TEST_VAR = 'test-value';

      const { replaceEnv } = await import('../../src/hooks/env-variables');

      const context = {
        ...mockContext,
        content: 'Database URL: __ENV_TEST_VAR__'
      };

      const result = replaceEnv(context);
      expect(result).toBe('Database URL: test-value');

      // Clean up
      delete process.env.TEST_VAR;
    });

    it('should leave unknown environment variables unchanged', async () => {
      const { replaceEnv } = await import('../../src/hooks/env-variables');

      const context = {
        ...mockContext,
        content: 'Unknown: __ENV_UNKNOWN_VAR__'
      };

      const result = replaceEnv(context);
      expect(result).toBe('Unknown: __ENV_UNKNOWN_VAR__');
    });
  });

  describe('addTimestamp', () => {
    it('should replace __TIMESTAMP__ with formatted date', async () => {
      const { addTimestamp } = await import('../../src/hooks/timestamp');

      const context = {
        ...mockContext,
        content: 'Generated on __TIMESTAMP__'
      };

      const result = addTimestamp(context);

      expect(result).toContain('Generated on ');
      expect(result).not.toContain('__TIMESTAMP__');
      // Should contain a date pattern (month name and year)
      expect(result).toMatch(/\w+ \d{1,2}, \d{4}/);
    });
  });

  describe('replaceStructure', () => {
    it('should replace __STRUCTURE__ with project structure', async () => {
      const { replaceStructure } = await import('../../src/hooks/project-structure');

      const context = {
        ...mockContext,
        content: 'Project structure:\n__STRUCTURE__'
      };

      const result = await replaceStructure(context);

      expect(result).toContain('Project structure:');
      expect(result).not.toContain('__STRUCTURE__');
      expect(result).toContain('```');
    });
  });
});