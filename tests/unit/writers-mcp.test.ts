import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { MarkdownWriter } from '../../src/agents/writers/generic';
import { CursorWriter } from '../../src/agents/writers/cursor';
import type { ResolvedMcp } from '../../src/types';

const testDir = 'test-writers-mcp';

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

describe('Writers formatMcp', () => {
  it('MarkdownWriter formats MCP with merge false', () => {
    const writer = new MarkdownWriter();
    const mcp: ResolvedMcp = {
      name: 'server',
      config: { command: 'node' },
      outputPath: 'mcp.json'
    };

    const result = writer.formatMcp(mcp, false);
    const parsed = JSON.parse(result);
    expect(parsed.mcpServers.server.command).toBe('node');
  });

  it('MarkdownWriter merges existing MCP config', () => {
    const writer = new MarkdownWriter();
    writeFileSync('mcp.json', JSON.stringify({ mcpServers: { existing: { command: 'bun' } } }, null, 2));
    const mcp: ResolvedMcp = {
      name: 'server',
      config: { command: 'node' },
      outputPath: 'mcp.json'
    };

    const result = writer.formatMcp(mcp, true);
    const parsed = JSON.parse(result);
    expect(parsed.mcpServers.existing.command).toBe('bun');
    expect(parsed.mcpServers.server.command).toBe('node');
  });

  it('CursorWriter merges existing MCP config and handles invalid JSON', () => {
    const writer = new CursorWriter();
    const mcp: ResolvedMcp = {
      name: 'server',
      config: { command: 'node' },
      outputPath: 'cursor.json'
    };

    writeFileSync('cursor.json', '{ invalid json');
    const result = writer.formatMcp(mcp, true);
    const parsed = JSON.parse(result);
    expect(parsed.mcpServers.server.command).toBe('node');

    writeFileSync('cursor.json', JSON.stringify({ mcpServers: { existing: { command: 'bun' } } }, null, 2));
    const merged = JSON.parse(writer.formatMcp(mcp, true));
    expect(merged.mcpServers.existing.command).toBe('bun');
    expect(merged.mcpServers.server.command).toBe('node');
  });
});
