import { existsSync, readFileSync } from 'fs';
import type { Rule, Mcp } from '../../types';

export interface GenericWriter {
  formatContent(content: string, rule: Rule): string;
}

export class MarkdownWriter implements GenericWriter {
  formatContent(content: string, _rule: Rule): string {
    // Generic markdown - return content as-is
    return content;
  }

  formatMcp(mcp: Mcp, merge: boolean): string {
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

    // Standard MCP format (Claude Desktop format)
    if (!existingConfig.mcpServers) {
      existingConfig.mcpServers = {};
    }

    existingConfig.mcpServers[mcp.name] = mcp.config;

    return JSON.stringify(existingConfig, null, 2);
  }
}