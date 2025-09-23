import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';

describe('CLI - Reset Command', () => {
  const testDir = 'test-cli-reset';
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

  it('should reset configuration successfully', () => {
    // Create config and rule files
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: [
    {
      file: 'test.md',
      to: './',
      targets: ['claude', 'cursor']
    }
  ]
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);
    writeFileSync('test.md', '# Test content');

    // First sync to generate files
    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    // Verify files were created
    expect(existsSync('CLAUDE.md')).toBe(true);
    expect(existsSync('.cursor/rules')).toBe(true);
    expect(existsSync('.gloo')).toBe(true);

    // Now reset
    const result = execSync(`bun run ${cliPath} reset --force`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('✅ Reset completed!');

    // Verify generated files are removed but source files remain
    expect(existsSync('CLAUDE.md')).toBe(false);
    expect(existsSync('.cursor/rules')).toBe(false);
    expect(existsSync('.cursor')).toBe(false); // Should be removed if empty
    expect(existsSync('.gloo')).toBe(false);
    expect(existsSync('test.md')).toBe(true); // Source file should remain
    expect(existsSync('gloo.config.ts')).toBe(false); // Config file is removed by reset
  });

  it('should reset with MCP configurations', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: [
    {
      file: 'test.md',
      to: './',
      targets: ['claude']
    }
  ],
  mcps: [
    {
      name: 'postgres',
      config: {
        command: 'npx',
        args: ['pg-mcp-server']
      },
      outputPath: '.mcp.json'
    }
  ]
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);
    writeFileSync('test.md', '# Test content');

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    // Verify files were created
    expect(existsSync('CLAUDE.md')).toBe(true);
    expect(existsSync('.mcp.json')).toBe(true);

    const result = execSync(`bun run ${cliPath} reset --force`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('✅ Reset completed!');

    // Verify files are removed
    expect(existsSync('CLAUDE.md')).toBe(false);
    expect(existsSync('.mcp.json')).toBe(false);
  });

  it('should handle reset when no generated files exist', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: []
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    const result = execSync(`bun run ${cliPath} reset --force`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('✅ Reset completed!');
  });

  it('should reset with custom config directory', () => {
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
    writeFileSync('gloo.config.ts', config);
    writeFileSync('test.md', '# Test content');

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    // Verify custom directory was created
    expect(existsSync('custom-rules')).toBe(true);
    expect(existsSync('CLAUDE.md')).toBe(true);

    const result = execSync(`bun run ${cliPath} reset --force`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('✅ Reset completed!');

    // Verify files are removed
    expect(existsSync('CLAUDE.md')).toBe(false);
    // Custom config directory is removed if it matches known patterns
    expect(existsSync('custom-rules')).toBe(false);
  });

  it('should prompt for confirmation when config file is missing', () => {
    const cliPath = `${originalCwd}/src/cli/index.ts`;

    const result = execSync(`bun run ${cliPath} reset`, { encoding: 'utf-8' });
    expect(result).toContain('⚠️  This will remove all ai-rules generated files');
  });

  it('should reset with backup enabled', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
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
    writeFileSync('gloo.config.ts', config);
    writeFileSync('test.md', '# Test content');

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    // Verify files and backup directory were created
    expect(existsSync('CLAUDE.md')).toBe(true);
    expect(existsSync('.gloo')).toBe(true);

    const result = execSync(`bun run ${cliPath} reset --force`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('✅ Reset completed!');

    // Verify all generated files are removed
    expect(existsSync('CLAUDE.md')).toBe(false);
    expect(existsSync('.gloo')).toBe(false);
  });
});