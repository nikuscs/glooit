import type { Agent, Rule, Mcp } from '../../types';
import { MarkdownWriter } from './generic';
import { CursorWriter } from './cursor';

export interface AgentWriter {
  formatContent(content: string, rule: Rule): string;
  formatMcp?(mcp: Mcp, merge: boolean): string;
}

export class AgentWriterFactory {
  static createWriter(agent: Agent): AgentWriter {
    switch (agent) {
      case 'cursor':
        return new CursorWriter();
      case 'claude':
      case 'codex':
      case 'roocode':
        return new MarkdownWriter();
      default:
        return new MarkdownWriter();
    }
  }
}