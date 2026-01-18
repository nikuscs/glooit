import { describe, it, expect, vi } from 'vitest';

vi.mock('fs', () => ({
  readdirSync: () => { throw new Error('boom'); },
  statSync: () => { throw new Error('boom'); }
}));

describe('replaceStructure read errors', () => {
  it('returns an empty tree when directory reads fail', async () => {
    const { replaceStructure } = await import('../../src/hooks/project-structure');

    const result = await replaceStructure({
      config: { rules: [] },
      rule: { file: 'a.md', to: './', targets: ['claude'] },
      content: '__STRUCTURE__',
      targetPath: 'x',
      agent: 'claude'
    });

    expect(result).toBe('```\n\n```');
  });
});
