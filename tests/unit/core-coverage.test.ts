import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { AIRulesCore } from '../../src/core';
import type { Config } from '../../src/types';

const testDir = 'test-core-coverage';

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
  process.chdir(testDir);
});

afterEach(() => {
  process.chdir('..');
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe('AIRulesCore coverage', () => {
  it('collects all generated paths', () => {
    writeFileSync('a.md', '# A');
    writeFileSync('b.md', '# B');

    const config: Config = {
      rules: [
        { file: 'a.md', to: './', targets: ['claude'] },
        { file: 'b.md', to: './', targets: [{ name: 'cursor', to: './custom.mdc' }] }
      ],
      commands: 'commands',
      skills: { path: 'skills', targets: ['claude'] },
      agents: { path: 'agents', targets: ['cursor'] },
      mcps: [
        { name: 'local', config: { command: 'node' }, outputPath: 'mcp.json' },
        { name: 'default', config: { command: 'node' }, targets: ['claude'] }
      ],
      hooks: [
        { event: 'beforeShellExecution', command: 'echo ok', targets: ['claude', 'cursor'] }
      ]
    };

    const core = new AIRulesCore(config);
    const paths = core.collectAllGeneratedPaths();

    expect(paths).toContain('CLAUDE.md');
    expect(paths).toContain('./custom.mdc');
    expect(paths).toContain('.claude/commands');
    expect(paths).toContain('.claude/skills');
    expect(paths).toContain('.cursor/agents');
    expect(paths).toContain('mcp.json');
    expect(paths).toContain('.mcp.json');
    expect(paths).toContain('.claude/settings.json');
    expect(paths).toContain('.cursor/hooks.json');
  });

  it('sync handles directory sync with unsupported targets', async () => {
    mkdirSync('commands', { recursive: true });
    writeFileSync('rule.md', '# Rule');

    const config: Config = {
      rules: [{ file: 'rule.md', to: './', targets: ['claude'] }],
      commands: { path: 'commands', targets: ['generic'] }
    };

    const core = new AIRulesCore(config);
    await core.sync();
    expect(existsSync('CLAUDE.md')).toBe(true);
  });

  it('sync skips directory sync when path is missing', async () => {
    writeFileSync('rule.md', '# Rule');
    const config: Config = {
      rules: [{ file: 'rule.md', to: './', targets: ['claude'] }],
      commands: 'missing-commands'
    };

    const core = new AIRulesCore(config);
    await core.sync();
    expect(existsSync('CLAUDE.md')).toBe(true);
  });

  it('sync merges MCPs and handles invalid existing JSON', async () => {
    mkdirSync('mcp', { recursive: true });
    writeFileSync('rule.md', '# Rule');
    writeFileSync('mcp/config.json', '{ invalid json');

    const config: Config = {
      mergeMcps: true,
      rules: [{ file: 'rule.md', to: './', targets: ['claude'] }],
      mcps: [{ name: 'server', config: { command: 'node' }, outputPath: 'mcp/config.json' }]
    };

    const core = new AIRulesCore(config);
    await core.sync();

    const content = JSON.parse(readFileSync('mcp/config.json', 'utf-8'));
    expect(content.mcpServers.server.command).toBe('node');
  });

  it('sync throws for duplicate MCP names', async () => {
    writeFileSync('rule.md', '# Rule');
    const config: Config = {
      rules: [{ file: 'rule.md', to: './', targets: ['claude'] }],
      mcps: [
        { name: 'dup', config: { command: 'node' } },
        { name: 'dup', config: { command: 'node' } }
      ]
    };

    const core = new AIRulesCore(config);
    await expect(core.sync()).rejects.toThrow('Duplicate MCP names found');
  });

  it('sync overwrites MCPs when mergeMcps is false', async () => {
    writeFileSync('rule.md', '# Rule');
    writeFileSync('mcp.json', JSON.stringify({ mcpServers: { existing: { command: 'old' } } }, null, 2));

    const config: Config = {
      mergeMcps: false,
      rules: [{ file: 'rule.md', to: './', targets: ['claude'] }],
      mcps: [{ name: 'server', config: { command: 'node' }, outputPath: 'mcp.json' }]
    };

    const core = new AIRulesCore(config);
    await core.sync();

    const parsed = JSON.parse(readFileSync('mcp.json', 'utf-8'));
    expect(parsed.mcpServers.existing).toBeUndefined();
    expect(parsed.mcpServers.server.command).toBe('node');
  });

  it('runs error transforms when sync fails', async () => {
    const errorTransform = vi.fn();
    const config: Config = {
      rules: [{ file: 'missing.md', to: './', targets: ['claude'] }],
      transforms: { error: [errorTransform] }
    };

    const core = new AIRulesCore(config);
    await expect(core.sync()).rejects.toThrow();
    expect(errorTransform).toHaveBeenCalled();
  });

  it('validate returns false when files are missing', async () => {
    const config: Config = {
      rules: [{ file: 'missing.md', to: './', targets: ['claude'] }]
    };

    const core = new AIRulesCore(config);
    const result = await core.validate();
    expect(result).toBe(false);
  });

  it('createBackup returns empty when disabled', async () => {
    const config: Config = {
      rules: [],
      backup: { enabled: false }
    };

    const core = new AIRulesCore(config);
    const result = await core.createBackup();
    expect(result).toBe('');
  });

  it('clean clears manifest and gitignore', async () => {
    writeFileSync('rule.md', '# Rule');
    const config: Config = { rules: [{ file: 'rule.md', to: './', targets: ['claude'] }] };

    const core = new AIRulesCore(config);
    await core.sync();
    await core.clean();

    expect(existsSync('.agents/manifest.json')).toBe(false);
  });

  it('returns early when MCPs are not configured', async () => {
    const core = new AIRulesCore({ rules: [] } as Config);
    await (core as unknown as { distributeMcps: () => Promise<void> }).distributeMcps();
    (core as unknown as { validateMcpNames: () => void }).validateMcpNames();
  });

  it('skips empty MCP groups', async () => {
    const core = new AIRulesCore({ rules: [], mcps: [] } as Config);
    const originalIterator = Map.prototype[Symbol.iterator];

    try {
      Map.prototype[Symbol.iterator] = function* () {
        yield ['mcp.json', []];
      };

      await (core as unknown as { distributeMcps: () => Promise<void> }).distributeMcps();
    } finally {
      Map.prototype[Symbol.iterator] = originalIterator;
    }
  });
});
