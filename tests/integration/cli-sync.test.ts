import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

describe('CLI - Sync Command', () => {
  const testDir = 'test-cli-sync';
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

  it('should sync configuration successfully', () => {
    // Create config file
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.glooit',
  rules: [
    {
      file: 'test.md',
      to: './',
      targets: ['claude']
    }
  ]
} satisfies Config;
`;
    writeFileSync('glooit.config.ts', config);
    writeFileSync('test.md', '# Test content for sync');

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    const result = execSync(`bun run ${cliPath} sync`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('✅ Sync completed!');
    expect(existsSync('CLAUDE.md')).toBe(true);
    expect(readFileSync('CLAUDE.md', 'utf-8')).toContain('# Test content for sync');
  });

  it('should handle multiple targets in sync', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.glooit',
  rules: [
    {
      file: 'shared.md',
      to: './',
      targets: ['claude', 'cursor']
    }
  ]
} satisfies Config;
`;
    writeFileSync('glooit.config.ts', config);
    writeFileSync('shared.md', '# Shared content');

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('CLAUDE.md')).toBe(true);
    expect(existsSync('.cursor/rules/shared.mdc')).toBe(true);

    const claudeContent = readFileSync('CLAUDE.md', 'utf-8');
    const cursorContent = readFileSync('.cursor/rules/shared.mdc', 'utf-8');

    expect(claudeContent).toContain('# Shared content');
    expect(cursorContent).toContain('---');
    expect(cursorContent).toContain('description:');
    expect(cursorContent).toContain('# Shared content');
  });

  it('should create backup during sync when enabled', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.glooit',
  rules: [
    {
      file: 'test.md',
      to: './',
      targets: ['claude']
    }
  ],
  backup: {
    enabled: true,
    retention: 5
  }
} satisfies Config;
`;
    writeFileSync('glooit.config.ts', config);
    writeFileSync('test.md', '# Test content');

    // First sync to create initial files
    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    // Check that backup directory is created
    expect(existsSync('.glooit/backups')).toBe(true);
  });

  it('should sync with custom config directory', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: 'custom-rules',
  rules: [
    {
      file: 'test.md',
      to: './',
      targets: ['claude']
    }
  ]
} satisfies Config;
`;
    writeFileSync('glooit.config.ts', config);
    writeFileSync('test.md', '# Custom config test');

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('CLAUDE.md')).toBe(true);
    // configDir is only created when backup is enabled or files are stored there
  });

  it('should fail sync with missing rule file', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.glooit',
  rules: [
    {
      file: 'missing.md',
      to: './',
      targets: ['claude']
    }
  ]
} satisfies Config;
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;

    expect(() => {
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });
    }).toThrow();
  });

  it('should sync with globs for cursor', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.glooit',
  rules: [
    {
      file: 'test.md',
      to: './',
      targets: ['cursor'],
      globs: 'src/**/*.ts'
    }
  ]
} satisfies Config;
`;
    writeFileSync('glooit.config.ts', config);
    writeFileSync('test.md', '# Test with globs');

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.cursor/rules/test.mdc')).toBe(true);
    const content = readFileSync('.cursor/rules/test.mdc', 'utf-8');
    expect(content).toContain('globs: src/**/*.ts');
  });
});