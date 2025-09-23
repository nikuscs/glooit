import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

describe('CLI - Clean Command', () => {
  const testDir = 'test-cli-clean';
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

  it('should clean configuration successfully', () => {
    // Create config and rule files
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
    expect(existsSync('.gloo')).toBe(true);

    // Create a gitignore to test cleanup
    writeFileSync('.gitignore', 'some-file\n# ai-rules generated files\nCLAUDE.md\nother-file\n');

    // Now clean
    const result = execSync(`bun run ${cliPath} clean`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('✅ Cleanup completed!');

    // Check that gitignore was cleaned up
    const gitignoreContent = readFileSync('.gitignore', 'utf-8');
    expect(gitignoreContent).not.toContain('# ai-rules generated files');
    expect(gitignoreContent).not.toContain('CLAUDE.md');
    expect(gitignoreContent).toContain('some-file');
    expect(gitignoreContent).toContain('other-file');
  });

  it('should handle clean when no gitignore exists', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: []
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    const result = execSync(`bun run ${cliPath} clean`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('✅ Cleanup completed!');
    expect(existsSync('.gitignore')).toBe(false);
  });

  it('should handle clean with custom config directory', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: 'custom-ai-rules',
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
    expect(existsSync('custom-ai-rules')).toBe(true);

    const result = execSync(`bun run ${cliPath} clean`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('✅ Cleanup completed!');
  });

  it('should clean with multiple targets', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: [
    {
      file: 'shared.md',
      to: './',
      targets: ['claude', 'cursor']
    }
  ]
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);
    writeFileSync('shared.md', '# Shared content');

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    // Verify files were created
    expect(existsSync('CLAUDE.md')).toBe(true);
    expect(existsSync('.cursor/rules/shared.md')).toBe(true);

    const result = execSync(`bun run ${cliPath} clean`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('✅ Cleanup completed!');
  });

  it('should fail clean when config file is missing', () => {
    const cliPath = `${originalCwd}/src/cli/index.ts`;

    expect(() => {
      execSync(`bun run ${cliPath} clean`, { encoding: 'utf-8' });
    }).toThrow();
  });
});