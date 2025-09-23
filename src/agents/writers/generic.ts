import type { Rule } from '../../types';

export interface GenericWriter {
  formatContent(content: string, rule: Rule): string;
}

export class MarkdownWriter implements GenericWriter {
  formatContent(content: string, _rule: Rule): string {
    // Generic markdown - return content as-is
    return content;
  }
}