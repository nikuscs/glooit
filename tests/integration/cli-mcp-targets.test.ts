import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

describe('CLI - MCP Targets and Agent Features', () => {
  const testDir = 'test-cli-mcp-targets';
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

  it('should support MCP targets like rules', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: [],
  mcps: [
    {
      name: 'shared-server',
      config: {
        command: 'shared-mcp',
        args: ['--port', '3000']
      },
      targets: ['claude', 'cursor']
    }
  ],
  mergeMcps: false
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    // Should create files for both targets
    expect(existsSync('.mcp.json')).toBe(true);
    expect(existsSync('.cursor/mcp.json')).toBe(true);

    const claudeConfig = JSON.parse(readFileSync('.mcp.json', 'utf-8'));
    const cursorConfig = JSON.parse(readFileSync('.cursor/mcp.json', 'utf-8'));

    expect(claudeConfig.mcpServers['shared-server']).toEqual({
      command: 'shared-mcp',
      args: ['--port', '3000']
    });

    expect(cursorConfig.mcpServers['shared-server']).toEqual({
      command: 'shared-mcp',
      args: ['--port', '3000']
    });
  });

  it('should validate and reject duplicate MCP names', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: [],
  mcps: [
    {
      name: 'duplicate-server',
      config: {
        command: 'server1'
      },
      targets: ['claude']
    },
    {
      name: 'duplicate-server',
      config: {
        command: 'server2'
      },
      targets: ['cursor']
    }
  ]
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;

    expect(() => {
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });
    }).toThrow();
  });

  it('should use correct default paths for different agents', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: [],
  mcps: [
    {
      name: 'roo-server',
      config: {
        command: 'roo-mcp'
      },
      targets: ['roocode']
    }
  ],
  mergeMcps: false
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    // Should use default roocode path
    expect(existsSync('.roo/mcp.json')).toBe(true);

    const rooConfig = JSON.parse(readFileSync('.roo/mcp.json', 'utf-8'));
    expect(rooConfig.mcpServers['roo-server']).toEqual({
      command: 'roo-mcp'
    });
  });

  it('should override default paths with custom outputPath', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: [],
  mcps: [
    {
      name: 'custom-path-server',
      config: {
        command: 'custom-mcp'
      },
      targets: ['cursor'],
      outputPath: 'custom-cursor-mcp.json'
    }
  ]
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    // Should use custom path instead of default
    expect(existsSync('custom-cursor-mcp.json')).toBe(true);
    expect(existsSync('.cursor/mcp.json')).toBe(false);

    const customConfig = JSON.parse(readFileSync('custom-cursor-mcp.json', 'utf-8'));
    expect(customConfig.mcpServers['custom-path-server']).toEqual({
      command: 'custom-mcp'
    });
  });

  it('should handle complex MCP configurations with all features', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: [],
  mcps: [
    {
      name: 'search-server',
      config: {
        command: 'npx',
        args: ['-y', 'example-search-mcp'],
        env: {
          SEARCH_API_KEY: 'your-search-api-key-here'
        },
        type: 'stdio'
      },
      targets: ['claude', 'cursor']
    },
    {
      name: 'remote-api',
      config: {
        url: 'https://api.example.com/mcp',
        headers: {
          Authorization: 'Bearer your-token-here'
        },
        type: 'remote'
      },
      targets: ['cursor']
    },
    {
      name: 'roo-server',
      config: {
        command: 'python',
        args: ['/path/to/server.py'],
        env: {
          API_KEY: 'your_api_key'
        },
        alwaysAllow: ['tool1', 'tool2'],
        disabled: false
      },
      targets: ['roocode']
    }
  ],
  mergeMcps: false
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    // Check Claude config
    expect(existsSync('.mcp.json')).toBe(true);
    const claudeConfig = JSON.parse(readFileSync('.mcp.json', 'utf-8'));
    expect(claudeConfig.mcpServers['search-server']).toBeDefined();
    expect(claudeConfig.mcpServers['remote-api']).toBeUndefined(); // Not targeted to claude

    // Check Cursor config
    expect(existsSync('.cursor/mcp.json')).toBe(true);
    const cursorConfig = JSON.parse(readFileSync('.cursor/mcp.json', 'utf-8'));
    expect(cursorConfig.mcpServers['search-server']).toBeDefined();
    expect(cursorConfig.mcpServers['remote-api']).toBeDefined();
    expect(cursorConfig.mcpServers['roo-server']).toBeUndefined(); // Not targeted to cursor

    // Check Roocode config
    expect(existsSync('.roo/mcp.json')).toBe(true);
    const rooConfig = JSON.parse(readFileSync('.roo/mcp.json', 'utf-8'));
    expect(rooConfig.mcpServers['roo-server']).toBeDefined();
    expect(rooConfig.mcpServers['search-server']).toBeUndefined(); // Not targeted to roocode
  });

  it('should handle multiple MCPs targeting same file correctly', () => {
    const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.gloo',
  rules: [],
  mcps: [
    {
      name: 'server1',
      config: {
        command: 'server1-cmd'
      },
      targets: ['claude']
    },
    {
      name: 'server2',
      config: {
        command: 'server2-cmd'
      },
      targets: ['claude']
    }
  ],
  mergeMcps: false
} satisfies Config;
`;
    writeFileSync('gloo.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.mcp.json')).toBe(true);
    const claudeConfig = JSON.parse(readFileSync('.mcp.json', 'utf-8'));

    // Both servers should be in the same file
    expect(claudeConfig.mcpServers['server1']).toEqual({ command: 'server1-cmd' });
    expect(claudeConfig.mcpServers['server2']).toEqual({ command: 'server2-cmd' });
  });
});