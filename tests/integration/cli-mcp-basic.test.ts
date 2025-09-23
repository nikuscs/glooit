import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

describe('CLI - MCP Basic Configuration', () => {
  const testDir = 'test-cli-mcp-basic';
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

  it('should generate MCP configuration files with merge enabled', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.ai-rules',
  rules: [],
  mcps: [
    {
      name: 'postgres',
      config: {
        command: 'npx',
        args: ['pg-mcp-server'],
        env: { DATABASE_URL: 'postgresql://localhost/test' },
        type: 'stdio'
      },
      targets: ['claude']
    },
    {
      name: 'redis',
      config: {
        command: 'redis-cli',
        type: 'stdio'
      },
      targets: ['claude']
    }
  ],
  mergeMcps: true
} satisfies Config;
`;
    writeFileSync('ai-rules.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('claude_desktop_config.json')).toBe(true);
    const mcpConfig = JSON.parse(readFileSync('claude_desktop_config.json', 'utf-8'));

    expect(mcpConfig.mcpServers).toBeDefined();
    expect(mcpConfig.mcpServers.postgres).toEqual({
      command: 'npx',
      args: ['pg-mcp-server'],
      env: { DATABASE_URL: 'postgresql://localhost/test' },
      type: 'stdio'
    });

    expect(mcpConfig.mcpServers.redis).toEqual({
      command: 'redis-cli',
      type: 'stdio'
    });
  });

  it('should merge with existing MCP configuration when mergeMcps is true', () => {
    // Create existing config
    const existingConfig = {
      mcpServers: {
        'existing-server': {
          command: 'existing-command'
        }
      },
      otherSettings: {
        someValue: 'preserved'
      }
    };
    writeFileSync('claude_desktop_config.json', JSON.stringify(existingConfig, null, 2));

    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.ai-rules',
  rules: [],
  mcps: [
    {
      name: 'new-server',
      config: {
        command: 'new-command'
      },
      targets: ['claude']
    }
  ],
  mergeMcps: true
} satisfies Config;
`;
    writeFileSync('ai-rules.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    const mcpConfig = JSON.parse(readFileSync('claude_desktop_config.json', 'utf-8'));

    // Should preserve existing config
    expect(mcpConfig.mcpServers['existing-server']).toEqual({ command: 'existing-command' });
    expect(mcpConfig.otherSettings).toEqual({ someValue: 'preserved' });

    // Should add new config
    expect(mcpConfig.mcpServers['new-server']).toEqual({ command: 'new-command' });
  });

  it('should overwrite existing MCP configuration when mergeMcps is false', () => {
    // Create existing config
    const existingConfig = {
      mcpServers: {
        'existing-server': {
          command: 'existing-command'
        }
      },
      otherSettings: {
        someValue: 'preserved'
      }
    };
    writeFileSync('claude_desktop_config.json', JSON.stringify(existingConfig, null, 2));

    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.ai-rules',
  rules: [],
  mcps: [
    {
      name: 'new-server',
      config: {
        command: 'new-command'
      },
      targets: ['claude']
    }
  ],
  mergeMcps: false
} satisfies Config;
`;
    writeFileSync('ai-rules.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    const mcpConfig = JSON.parse(readFileSync('claude_desktop_config.json', 'utf-8'));

    // Should NOT preserve existing config
    expect(mcpConfig.mcpServers['existing-server']).toBeUndefined();
    expect(mcpConfig.otherSettings).toBeUndefined();

    // Should only have new config
    expect(mcpConfig.mcpServers['new-server']).toEqual({ command: 'new-command' });
  });

  it('should support custom output paths for different MCP files', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.ai-rules',
  rules: [],
  mcps: [
    {
      name: 'claude-mcp',
      config: {
        command: 'claude-server'
      },
      targets: ['claude'],
      outputPath: 'claude_config.json'
    },
    {
      name: 'cursor-mcp',
      config: {
        command: 'cursor-server'
      },
      targets: ['cursor'],
      outputPath: '.cursor/mcp.json'
    }
  ],
  mergeMcps: true
} satisfies Config;
`;
    writeFileSync('ai-rules.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    // Check Claude config
    expect(existsSync('claude_config.json')).toBe(true);
    const claudeConfig = JSON.parse(readFileSync('claude_config.json', 'utf-8'));
    expect(claudeConfig.mcpServers['claude-mcp']).toEqual({ command: 'claude-server' });

    // Check Cursor config
    expect(existsSync('.cursor/mcp.json')).toBe(true);
    const cursorConfig = JSON.parse(readFileSync('.cursor/mcp.json', 'utf-8'));
    expect(cursorConfig.mcpServers['cursor-mcp']).toEqual({ command: 'cursor-server' });
  });

  it('should handle MCP files in reset command', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.ai-rules',
  rules: [],
  mcps: [
    {
      name: 'test-server',
      config: {
        command: 'test-command'
      },
      targets: ['claude']
    }
  ]
} satisfies Config;
`;
    writeFileSync('ai-rules.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    // Verify MCP file was created
    expect(existsSync('claude_desktop_config.json')).toBe(true);

    // Reset should remove MCP files
    execSync(`bun run ${cliPath} reset --force`, { encoding: 'utf-8' });

    expect(existsSync('claude_desktop_config.json')).toBe(false);
  });

  it('should validate MCP configuration', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.ai-rules',
  rules: [],
  mcps: [
    {
      name: 'valid-server',
      config: {
        command: 'server-command'
      },
      targets: ['claude']
    }
  ]
} satisfies Config;
`;
    writeFileSync('ai-rules.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    const result = execSync(`bun run ${cliPath} validate`, {
      encoding: 'utf-8'
    });

    expect(result).toContain('Configuration is valid');
  });
});