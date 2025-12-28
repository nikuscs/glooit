import type { AgentName, Rule, ResolvedMcp } from '../../types';
import { MarkdownWriter } from './generic';
import { CursorWriter } from './cursor';

export interface AgentWriter {
  formatContent(content: string, rule: Rule): string;
  formatMcp?(mcp: ResolvedMcp, merge: boolean): string;
}

export class AgentWriterFactory {
  static createWriter(agent: AgentName): AgentWriter {
    switch (agent) {
      case 'cursor':
        return new CursorWriter();
      case 'claude':
      case 'codex':
      case 'roocode':
      case 'opencode':
      case 'generic':
        return new MarkdownWriter();
      default:
        return new MarkdownWriter();
    }
  }
}