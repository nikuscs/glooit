import { basename } from 'path';
import type { Rule } from '../../types';

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

  private extractRuleName(filePath: string): string {
    return basename(filePath, '.md');
  }
}