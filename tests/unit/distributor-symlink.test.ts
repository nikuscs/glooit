import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, lstatSync, readFileSync } from 'fs';
import { AgentDistributor } from '../../src/agents/distributor';
import type { Config, Rule } from '../../src/types';

const testDir = 'test-symlink';

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

describe('AgentDistributor symlink mode', () => {
  it('creates symlink for a single rule file', async () => {
    mkdirSync('.agents', { recursive: true });
    writeFileSync('.agents/main.md', '# Main');

    const config: Config = { rules: [], mode: 'symlink' };
    const symlinkPaths = new Set<string>();
    const distributor = new AgentDistributor(config, symlinkPaths);

    const rule: Rule = {
      name: 'main',
      file: '.agents/main.md',
      to: './',
      targets: ['claude'],
      mode: 'symlink'
    };

    await distributor.distributeRule(rule);

    expect(existsSync('CLAUDE.md')).toBe(true);
    expect(lstatSync('CLAUDE.md').isSymbolicLink()).toBe(true);
    expect(symlinkPaths.has('CLAUDE.md')).toBe(true);
  });

  it('replaces existing target and warns', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    mkdirSync('.agents', { recursive: true });
    writeFileSync('.agents/main.md', '# Main');
    writeFileSync('CLAUDE.md', '# Old');

    const config: Config = { rules: [], mode: 'symlink' };
    const symlinkPaths = new Set<string>();
    const distributor = new AgentDistributor(config, symlinkPaths);

    const rule: Rule = {
      name: 'main',
      file: '.agents/main.md',
      to: './',
      targets: ['claude'],
      mode: 'symlink'
    };

    await distributor.distributeRule(rule);

    expect(lstatSync('CLAUDE.md').isSymbolicLink()).toBe(true);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('symlinks directory contents recursively', async () => {
    mkdirSync('.agents/commands/nested', { recursive: true });
    writeFileSync('.agents/commands/nested/run.md', '# Run');

    const config: Config = { rules: [], mode: 'symlink' };
    const symlinkPaths = new Set<string>();
    const distributor = new AgentDistributor(config, symlinkPaths);

    const rule: Rule = {
      name: 'commands',
      file: '.agents/commands',
      to: './',
      targets: ['claude'],
      mode: 'symlink'
    };

    await distributor.distributeRule(rule);

    expect(lstatSync('.claude/commands/nested/run.md').isSymbolicLink()).toBe(true);
  });

  it('falls back to copy on merge rules in symlink mode', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    writeFileSync('part1.md', '# Part 1');
    writeFileSync('part2.md', '# Part 2');

    const config: Config = { rules: [], mode: 'symlink' };
    const symlinkPaths = new Set<string>();
    const distributor = new AgentDistributor(config, symlinkPaths);

    const rule: Rule = {
      file: ['part1.md', 'part2.md'],
      to: './',
      targets: [{ name: 'claude', to: './MERGED.md' }],
      mode: 'symlink'
    };

    await distributor.distributeRule(rule);

    expect(lstatSync('MERGED.md').isSymbolicLink()).toBe(false);
    expect(readFileSync('MERGED.md', 'utf-8')).toContain('# Part 1');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('shows warning only once for the same rule across multiple distribute calls', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    mkdirSync('.agents', { recursive: true });
    writeFileSync('.agents/main.md', '# Main');
    writeFileSync('.agents/other.md', '# Other');

    const config: Config = { rules: [], mode: 'symlink' };
    const symlinkPaths = new Set<string>();
    const distributor = new AgentDistributor(config, symlinkPaths);

    const rule1: Rule = {
      name: 'main',
      file: '.agents/main.md',
      to: './',
      targets: ['claude'],
      mode: 'symlink'
    };

    const rule2: Rule = {
      name: 'main', // Same name as rule1
      file: '.agents/other.md',
      to: './',
      targets: ['cursor'],
      mode: 'symlink'
    };

    await distributor.distributeRule(rule1);
    await distributor.distributeRule(rule2);

    // Should warn about symlink limitations only once for rule "main", not twice
    const limitationWarnings = warnSpy.mock.calls.filter(call =>
      call[0].includes('Symlink mode limitations for rule "main"')
    );
    expect(limitationWarnings.length).toBe(1);

    warnSpy.mockRestore();
  });

  it('throws descriptive error when source file missing', async () => {
    const config: Config = { rules: [], mode: 'symlink' };
    const symlinkPaths = new Set<string>();
    const distributor = new AgentDistributor(config, symlinkPaths);

    const rule: Rule = {
      name: 'missing',
      file: '.agents/missing.md',
      to: './',
      targets: ['claude'],
      mode: 'symlink'
    };

    await expect(distributor.distributeRule(rule)).rejects.toThrow(/Source file not found/);
  });

  it('throws descriptive error when directory symlink fails', async () => {
    // Create a scenario where symlink would fail by making target read-only
    mkdirSync('.agents/commands', { recursive: true });
    writeFileSync('.agents/commands/run.md', '# Run');
    mkdirSync('.claude/commands', { recursive: true });

    // Make the commands directory itself a file to cause symlink to fail
    rmSync('.claude/commands', { recursive: true, force: true });
    writeFileSync('.claude/commands', 'this is a file');

    const config: Config = { rules: [], mode: 'symlink' };
    const symlinkPaths = new Set<string>();
    const distributor = new AgentDistributor(config, symlinkPaths);

    const rule: Rule = {
      name: 'commands',
      file: '.agents/commands',
      to: './',
      targets: ['claude'],
      mode: 'symlink'
    };

    await expect(distributor.distributeRule(rule)).rejects.toThrow(/Failed to symlink directory/);
  });
});
