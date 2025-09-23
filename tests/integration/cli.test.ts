import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';

describe('CLI Integration Tests', () => {
  const testDir = 'test-cli-integration';
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

  it('should initialize configuration successfully', () => {
    const result = execSync('bun run ../src/cli/index.ts init --force', {
      encoding: 'utf-8',
      cwd: originalCwd
    });

    expect(result).toContain('✅ Created ai-rules.config.ts');
    expect(existsSync('ai-rules.config.ts')).toBe(true);
  });

  it('should validate configuration', () => {
    // Create a test config
    const config = `
      import { defineRules } from '../src/index';
      export default defineRules({
        rules: [{
          file: 'test.md',
          to: './',
          targets: ['claude']
        }]
      });
    `;
    writeFileSync('ai-rules.config.ts', config);
    writeFileSync('test.md', '# Test rule');

    const result = execSync('bun run ../src/cli/index.ts validate', {
      encoding: 'utf-8',
      cwd: originalCwd
    });

    expect(result).toContain('Configuration is valid');
  });

  it('should detect validation errors', () => {
    // Create a config with missing file
    const config = `
      import { defineRules } from '../src/index';
      export default defineRules({
        rules: [{
          file: 'missing.md',
          to: './',
          targets: ['claude']
        }]
      });
    `;
    writeFileSync('ai-rules.config.ts', config);

    try {
      execSync('bun run ../src/cli/index.ts validate', {
        encoding: 'utf-8',
        cwd: originalCwd
      });
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.stdout).toContain('Configuration validation failed');
      expect(error.stdout).toContain('Rule file not found');
    }
  });

  it('should sync rules to agents', () => {
    // Create test config and rule files
    const config = `
      import { defineRules } from '../src/index';
      export default defineRules({
        rules: [{
          file: 'test.md',
          to: './',
          targets: ['claude', 'cursor']
        }]
      });
    `;
    writeFileSync('ai-rules.config.ts', config);
    writeFileSync('test.md', '# Test rule content');

    const result = execSync('bun run ../src/cli/index.ts sync --no-backup', {
      encoding: 'utf-8',
      cwd: originalCwd
    });

    expect(result).toContain('✅ Sync completed');
    expect(existsSync('CLAUDE.md')).toBe(true);
    expect(existsSync('.cursor/rules/test.md')).toBe(true);
  });
});