import { existsSync, readFileSync } from 'fs';
import type { Rule, ResolvedMcp } from '../../types';

export interface GenericWriter {
  formatContent(content: string, rule: Rule): string;
}

export class MarkdownWriter implements GenericWriter {
  formatContent(content: string, _rule: Rule): string {
    return content;
  }

  formatMcp(mcp: ResolvedMcp, merge: boolean): string {
    let existingConfig: any = {};

    if (merge && existsSync(mcp.outputPath)) {
      try {
        const content = readFileSync(mcp.outputPath, 'utf-8');
        existingConfig = JSON.parse(content);
      } catch {
        existingConfig = {};
      }
    }

    if (!existingConfig.mcpServers) {
      existingConfig.mcpServers = {};
    }

    existingConfig.mcpServers[mcp.name] = mcp.config;

    return JSON.stringify(existingConfig, null, 2);
  }
}