import { describe, it, expect } from 'vitest';
import { MarkdownWriter } from '../../src/agents/writers/generic';
import { CursorWriter } from '../../src/agents/writers/cursor';
import { AgentWriterFactory } from '../../src/agents/writers';
import type { Rule } from '../../src/types';

describe('Agent Writers', () => {
  const mockRule: Rule = {
    file: '.glooit/test.md',
    to: './',
    targets: ['claude'],
    globs: 'src/**/*'
  };

  describe('MarkdownWriter', () => {
    it('should return content unchanged', () => {
      const writer = new MarkdownWriter();
      const content = '# Test Rule\n\nThis is a test rule.';

      const result = writer.formatContent(content, mockRule);

      expect(result).toBe(content);
    });
  });

  describe('CursorWriter', () => {
    it('should add frontmatter to content', () => {
      const writer = new CursorWriter();
      const content = '# Test Rule\n\nThis is a test rule.';

      const result = writer.formatContent(content, mockRule);

      expect(result).toContain('---');
      expect(result).toContain('description: AI Rules - test');
      expect(result).toContain('globs: src/**/*');
      expect(result).toContain('alwaysApply: true');
      expect(result).toContain('---');
      expect(result).toContain('# Test Rule');
    });

    it('should use default globs when not specified', () => {
      const writer = new CursorWriter();
      const ruleWithoutGlobs: Rule = {
        ...mockRule,
        globs: undefined
      };

      const result = writer.formatContent('# Test', ruleWithoutGlobs);

      expect(result).toContain('globs: **/*');
    });

    it('should extract rule name from file path', () => {
      const writer = new CursorWriter();
      const ruleWithComplexPath: Rule = {
        ...mockRule,
        file: './complex/path/to/my-rule.md'
      };

      const result = writer.formatContent('# Test', ruleWithComplexPath);

      expect(result).toContain('description: AI Rules - my-rule');
    });
  });

  describe('AgentWriterFactory', () => {
    it('should return CursorWriter for cursor agent', () => {
      const writer = AgentWriterFactory.createWriter('cursor');
      expect(writer).toBeInstanceOf(CursorWriter);
    });

    it('should return MarkdownWriter for generic agents', () => {
      const claudeWriter = AgentWriterFactory.createWriter('claude');
      const codexWriter = AgentWriterFactory.createWriter('codex');
      const roocodeWriter = AgentWriterFactory.createWriter('roocode');

      expect(claudeWriter).toBeInstanceOf(MarkdownWriter);
      expect(codexWriter).toBeInstanceOf(MarkdownWriter);
      expect(roocodeWriter).toBeInstanceOf(MarkdownWriter);
    });
  });
});