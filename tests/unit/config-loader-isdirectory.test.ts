import { describe, it, expect, vi } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: () => true,
    statSync: () => {
      throw new Error('boom');
    }
  };
});

describe('ConfigLoader isDirectoryPath', () => {
  it('returns false when statSync throws', async () => {
    const { ConfigLoader } = await import('../../src/core/config-loader');
    const result = (ConfigLoader as unknown as { isDirectoryPath: (path: string) => boolean })
      .isDirectoryPath('some-path');
    expect(result).toBe(false);
  });
});
