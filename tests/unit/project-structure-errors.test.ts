import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { replaceStructure } from '../../src/hooks/project-structure';

const testDir = 'test-project-structure';

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

describe('replaceStructure', () => {
  it('stops traversal beyond max depth', async () => {
    mkdirSync('a/b/c/d/e', { recursive: true });

    const result = await replaceStructure({
      config: { rules: [] },
      rule: { file: 'a.md', to: './', targets: ['claude'] },
      content: '__STRUCTURE__',
      targetPath: 'x',
      agent: 'claude'
    });

    expect(result).toContain('a');
  });

  it('returns unavailable fallback when tree serialization throws', async () => {
    const originalJoin = Array.prototype.join;
    Array.prototype.join = function mockedJoin(this: unknown[]): string {
      throw new Error('join-failed');
    };

    try {
      const result = await replaceStructure({
        config: { rules: [] },
        rule: { file: 'a.md', to: './', targets: ['claude'] },
        content: '__STRUCTURE__',
        targetPath: 'x',
        agent: 'claude'
      });

      expect(result).toContain('Project structure unavailable');
    } finally {
      Array.prototype.join = originalJoin;
    }
  });
});
