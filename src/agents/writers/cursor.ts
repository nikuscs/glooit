import { basename } from 'path';
import { existsSync, readFileSync } from 'fs';
import type { Rule, ResolvedMcp } from '../../types';

export class CursorWriter {
  formatContent(content: string, rule: Rule): string {
    const ruleName = this.extractRuleName(rule.file);

    const frontmatter = [
      '---',
      `description: AI Rules - ${ruleName}`,
      `globs: ${rule.globs || '**/*'}`,
      'alwaysApply: true',
      '---',
      ''
    ].join('\n');

    return frontmatter + content;
  }

  formatMcp(mcp: ResolvedMcp, merge: boolean): string {
    let existingConfig: any = {};

    // Read existing config if merge is enabled and file exists
    if (merge && existsSync(mcp.outputPath)) {
      try {
        const content = readFileSync(mcp.outputPath, 'utf-8');
        existingConfig = JSON.parse(content);
      } catch {
        // If file is corrupted or invalid JSON, start fresh
        existingConfig = {};
      }
    }

    // Cursor might use a different structure, but for now use standard MCP format
    if (!existingConfig.mcpServers) {
      existingConfig.mcpServers = {};
    }

    existingConfig.mcpServers[mcp.name] = mcp.config;

    return JSON.stringify(existingConfig, null, 2);
  }

  private extractRuleName(filePath: string): string {
    return basename(filePath, '.md');
  }
}