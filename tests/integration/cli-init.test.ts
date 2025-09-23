import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';

describe('CLI - Init Command', () => {
  const testDir = 'test-cli-init';
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
    const cliPath = `${originalCwd}/src/cli/index.ts`;
    const result = execSync(`bun run ${cliPath} init --force`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('✅ Created ai-rules.config.ts');
    expect(existsSync('ai-rules.config.ts')).toBe(true);
  });

  it('should prevent overwriting existing config without --force', () => {
    // Create existing config
    writeFileSync('ai-rules.config.ts', 'existing config');

    const cliPath = `${originalCwd}/src/cli/index.ts`;

    expect(() => {
      execSync(`bun run ${cliPath} init`, { encoding: 'utf-8' });
    }).toThrow();
  });

  it('should overwrite existing config with --force', () => {
    // Create existing config
    writeFileSync('ai-rules.config.ts', 'existing config');

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    const result = execSync(`bun run ${cliPath} init --force`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('✅ Created ai-rules.config.ts');
    expect(existsSync('ai-rules.config.ts')).toBe(true);
  });
});