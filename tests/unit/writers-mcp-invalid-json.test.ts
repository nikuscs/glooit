import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { MarkdownWriter } from '../../src/agents/writers/generic';
import { CursorWriter } from '../../src/agents/writers/cursor';
import type { ResolvedMcp, Rule } from '../../src/types';

const testDir = 'test-writers-invalid-json';

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

describe('Writers handle invalid JSON', () => {
  it('MarkdownWriter resets invalid JSON when merging MCP', () => {
    writeFileSync('mcp.json', '{not valid json');

    const writer = new MarkdownWriter();
    const mcp: ResolvedMcp = {
      name: 'test',
      config: { command: 'node' },
      outputPath: 'mcp.json'
    };

    const output = writer.formatMcp(mcp, true);
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers?.test).toEqual({ command: 'node' });
  });

  it('CursorWriter resets invalid JSON when merging MCP', () => {
    writeFileSync('cursor-mcp.json', '{bad json');

    const writer = new CursorWriter();
    const mcp: ResolvedMcp = {
      name: 'cursor-test',
      config: { command: 'node' },
      outputPath: 'cursor-mcp.json'
    };

    const output = writer.formatMcp(mcp, true);
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers?.['cursor-test']).toEqual({ command: 'node' });
  });

  it('CursorWriter uses first file in rule arrays', () => {
    const writer = new CursorWriter();
    const rule: Rule = { file: ['rules/a.md', 'rules/b.md'], to: './', targets: [{ name: 'cursor', to: './merged.md' }] };
    const content = writer.formatContent('hello', rule);

    expect(content).toContain('AI Rules - a');
  });
});
