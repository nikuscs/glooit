import { describe, it, expect } from 'vitest';
import { GitIgnoreManager } from '../../src/core/gitignore';
import type { Config } from '../../src/types';

describe('GitIgnoreManager extra coverage', () => {
  it('stops removing when a non-path line is reached', () => {
    const config: Config = { rules: [] };
    const manager = new GitIgnoreManager(config);

    const content = [
      '# Existing',
      manager['marker'],
      '/.agents/manifest.json',
      'not-a-path',
      ''
    ].join('\n');

    const cleaned = (manager as unknown as { removeExistingSection: (value: string) => string })
      .removeExistingSection(content);

    expect(cleaned).toContain('not-a-path');
  });
});
