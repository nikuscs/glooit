import { describe, it, expect } from 'vitest';
import { compact } from '../../src/hooks/compact';
import type { SyncContext } from '../../src/types';

describe('Compact Hook', () => {
  const mockContext: SyncContext = {
    config: { configDir: '.ai-rules', rules: [] },
    rule: { file: 'test.md', to: './', targets: ['claude'] },
    content: '',
    targetPath: './test.md',
    agent: 'claude'
  };

  describe('basic compacting', () => {
    it('should remove excessive newlines', () => {
      const compactHook = compact({ maxConsecutiveNewlines: 2 });
      const context = {
        ...mockContext,
        content: 'Line 1\n\n\n\n\nLine 2'
      };

      const result = compactHook(context);
      expect(result).toBe('Line 1\n\nLine 2');
    });

    it('should trim trailing spaces', () => {
      const compactHook = compact({ trimTrailingSpaces: true });
      const context = {
        ...mockContext,
        content: 'Line with trailing spaces   \nAnother line  '
      };

      const result = compactHook(context);
      expect(result).toBe('Line with trailing spaces\nAnother line');
    });

    it('should compact lists', () => {
      const compactHook = compact({ compactLists: true });
      const context = {
        ...mockContext,
        content: '- Item 1\n\n\n- Item 2\n\n\n- Item 3'
      };

      const result = compactHook(context);
      expect(result).toBe('- Item 1\n- Item 2\n- Item 3');
    });
  });

  describe('frontmatter preservation', () => {
    it('should preserve Cursor frontmatter when enabled', () => {
      const compactHook = compact({ preserveFrontmatter: true });
      const context = {
        ...mockContext,
        content: '---\ndescription: Test\nglobs: **/*\n---\n\n\n\nContent with lots of spaces   \n\n\nMore content'
      };

      const result = compactHook(context);

      expect(result).toContain('---\ndescription: Test\nglobs: **/*\n---');
      expect(result).toContain('Content with lots of spaces');
      expect(result).not.toContain('   \n');
      expect(result.split('\n\n\n').length).toBe(1); // No triple newlines
    });

    it('should handle content without frontmatter', () => {
      const compactHook = compact();
      const context = {
        ...mockContext,
        content: '# Header\n\n\n\nContent   \n\n\nMore content'
      };

      const result = compactHook(context);

      expect(result).toBe('# Header\n\nContent\n\nMore content');
    });
  });

  describe('filler word removal', () => {
    it('should remove filler words when enabled', () => {
      const compactHook = compact({ removeFillerWords: true });
      const context = {
        ...mockContext,
        content: 'This is basically a really good example that literally works very well.'
      };

      const result = compactHook(context);

      expect(result).not.toContain('basically');
      expect(result).not.toContain('really');
      expect(result).not.toContain('literally');
      expect(result).not.toContain('very');
      expect(result).toContain('This is a good example that works well.');
    });

    it('should preserve code blocks when removing fillers', () => {
      const compactHook = compact({ removeFillerWords: true });
      const context = {
        ...mockContext,
        content: 'This is basically wrong.\n\n```js\nconst really = "basically important";\n```\n\nBut this is literally correct.'
      };

      const result = compactHook(context);

      expect(result).toContain('const really = "basically important"');
      expect(result).not.toContain('This is basically wrong');
      expect(result).not.toContain('literally correct');
    });
  });

  describe('configuration options', () => {
    it('should respect custom options', () => {
      const compactHook = compact({
        maxConsecutiveNewlines: 1,
        removeFillerWords: false,
        trimTrailingSpaces: false
      });

      const context = {
        ...mockContext,
        content: 'Line 1   \n\n\nThis is basically good   '
      };

      const result = compactHook(context);

      expect(result).toBe('Line 1   \nThis is basically good   '); // Preserved trailing spaces and filler words
      expect(result.split('\n\n\n').length).toBe(1); // But limited newlines
    });
  });
});