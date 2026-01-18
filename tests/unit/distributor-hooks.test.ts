import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { AgentDistributor } from '../../src/agents/distributor';
import type { Config, Rule } from '../../src/types';

const testDir = 'test-distributor-hooks';

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

describe('AgentDistributor hooks and errors', () => {
  it('applies hooks and transforms', async () => {
    process.env.TEST_ENV = 'value';
    mkdirSync('src', { recursive: true });
    writeFileSync('rule.md', 'Env: __TEST_ENV__\nStruct: __STRUCTURE__\nTime: __TIMESTAMP__');

    const config: Config = {
      rules: [],
      transforms: {
        after: [({ content }) => content.replace('Env:', 'ENV:')]
      }
    };
    const distributor = new AgentDistributor(config);

    const rule: Rule = {
      file: 'rule.md',
      to: './',
      hooks: ['replaceEnv', 'replaceStructure', 'addTimestamp', 'unknown'],
      targets: ['claude']
    };

    await distributor.distributeRule(rule);

    const content = readFileSync('CLAUDE.md', 'utf-8');
    expect(content).toContain('ENV:');
    expect(content).toContain('```');
  });

  it('throws for unknown directory types without custom path', async () => {
    mkdirSync('weird', { recursive: true });
    const distributor = new AgentDistributor({ rules: [] });
    const rule: Rule = {
      name: 'weird',
      file: 'weird',
      to: './',
      targets: ['claude']
    };

    await expect(distributor.distributeRule(rule)).rejects.toThrow('Unknown directory type');
  });

  it('throws when agent does not support directory type', async () => {
    mkdirSync('commands', { recursive: true });
    const distributor = new AgentDistributor({ rules: [] });
    const rule: Rule = {
      name: 'commands',
      file: 'commands',
      to: './',
      targets: ['generic']
    };

    await expect(distributor.distributeRule(rule)).rejects.toThrow('does not support directory type');
  });

  it('throws when symlink source is missing', async () => {
    const distributor = new AgentDistributor({ rules: [], mode: 'symlink' });
    const rule: Rule = {
      file: 'missing.md',
      to: './',
      targets: ['claude'],
      mode: 'symlink'
    };

    await expect(distributor.distributeRule(rule)).rejects.toThrow('Source file not found');
  });

  it('copies non-markdown files without hooks', async () => {
    mkdirSync('commands', { recursive: true });
    writeFileSync('commands/script.sh', '#!/bin/bash');

    const distributor = new AgentDistributor({ rules: [] });
    const rule: Rule = {
      name: 'commands',
      file: 'commands',
      to: './',
      targets: ['claude']
    };

    await distributor.distributeRule(rule);
    expect(readFileSync('.claude/commands/script.sh', 'utf-8')).toContain('#!/bin/bash');
  });

  it('warns when symlink mode has hooks and transforms', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    writeFileSync('rule.md', 'test');

    const distributor = new AgentDistributor({ rules: [], transforms: { after: [() => 'x'] } });
    const rule: Rule = {
      file: 'rule.md',
      to: './',
      hooks: ['replaceEnv'],
      targets: ['claude'],
      mode: 'symlink'
    };

    await distributor.distributeRule(rule);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('uses custom path for directory rules', async () => {
    mkdirSync('custom-dir', { recursive: true });
    writeFileSync('custom-dir/readme.md', '# Custom');

    const distributor = new AgentDistributor({ rules: [] });
    const rule: Rule = {
      name: 'commands',
      file: 'custom-dir',
      to: './',
      targets: [{ name: 'claude', to: './custom-out' }]
    };

    await distributor.distributeRule(rule);
    expect(readFileSync('./custom-out/readme.md', 'utf-8')).toContain('# Custom');
  });

  it('uses custom path for symlink targets', async () => {
    writeFileSync('rule.md', 'test');
    const distributor = new AgentDistributor({ rules: [], mode: 'symlink' });
    const rule: Rule = {
      file: 'rule.md',
      to: './',
      targets: [{ name: 'claude', to: './custom-link.md' }],
      mode: 'symlink'
    };

    await distributor.distributeRule(rule);
    expect(readFileSync('./custom-link.md', 'utf-8')).toBe('test');
  });

  it('warns for transforms.before in symlink mode', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    writeFileSync('rule.md', 'test');

    const distributor = new AgentDistributor({ rules: [], transforms: { before: [() => undefined] } });
    const rule: Rule = {
      file: 'rule.md',
      to: './',
      targets: ['claude'],
      mode: 'symlink'
    };

    await distributor.distributeRule(rule);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
