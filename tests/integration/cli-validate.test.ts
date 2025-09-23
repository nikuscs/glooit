import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';

describe('CLI - Validate Command', () => {
  const testDir = 'test-cli-validate';
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

  it('should validate configuration successfully when all files exist', () => {
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
  commands: [
    {
      command: 'build',
      file: 'build.md',
      targets: ['cursor']
    }
  ]
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);
    writeFileSync('test.md', '# Test content');
    writeFileSync('build.md', '# Build command');

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    const result = execSync(`bun run ${cliPath} validate`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('Configuration is valid');
  });

  it('should fail validation when rule file is missing', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: [
    {
      file: 'missing.md',
      to: './',
      targets: ['claude']
    }
  ]
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;

    expect(() => {
      execSync(`bun run ${cliPath} validate`, { encoding: 'utf-8' });
    }).toThrow();
  });

  it('should fail validation when command file is missing', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: [],
  commands: [
    {
      command: 'test',
      file: 'missing-command.md',
      targets: ['cursor']
    }
  ]
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;

    expect(() => {
      execSync(`bun run ${cliPath} validate`, { encoding: 'utf-8' });
    }).toThrow();
  });

  it('should validate successfully with empty rules and commands', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: []
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    const result = execSync(`bun run ${cliPath} validate`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('Configuration is valid');
  });

  it('should validate with multiple rules and commands', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: [
    {
      file: 'rule1.md',
      to: './',
      targets: ['claude']
    },
    {
      file: 'rule2.md',
      to: './',
      targets: ['cursor']
    }
  ],
  commands: [
    {
      command: 'build',
      file: 'build.md',
      targets: ['claude']
    },
    {
      command: 'test',
      file: 'test-cmd.md',
      targets: ['cursor']
    }
  ]
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);
    writeFileSync('rule1.md', '# Rule 1');
    writeFileSync('rule2.md', '# Rule 2');
    writeFileSync('build.md', '# Build command');
    writeFileSync('test-cmd.md', '# Test command');

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    const result = execSync(`bun run ${cliPath} validate`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('Configuration is valid');
  });

  it('should fail validation when config file is missing', () => {
    const cliPath = `${originalCwd}/src/cli/index.ts`;

    expect(() => {
      execSync(`bun run ${cliPath} validate`, { encoding: 'utf-8' });
    }).toThrow();
  });
});