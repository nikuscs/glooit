import { describe, it, expect, afterEach, vi } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';

const tempDir = 'test-config-errors';

afterEach(() => {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
  vi.resetModules();
  vi.unmock('jiti');
});

describe('ConfigLoader error paths', () => {
  it('throws helpful error when jiti fails for ts config', async () => {
    mkdirSync(tempDir, { recursive: true });
    process.chdir(tempDir);

    vi.mock('jiti', () => ({
      createJiti: () => ({
        import: () => {
          throw new Error('boom');
        }
      })
    }));

    const { ConfigLoader } = await import('../../src/core/config-loader');

    writeFileSync('glooit.config.ts', 'export default { rules: [] };');

    await expect(ConfigLoader.load('glooit.config.ts')).rejects.toThrow('Failed to load TypeScript config');

    process.chdir('..');
  });

  it('throws when config module has no rules', async () => {
    mkdirSync(tempDir, { recursive: true });
    process.chdir(tempDir);

    const { ConfigLoader } = await import('../../src/core/config-loader');

    writeFileSync('glooit.config.js', 'export const config = { };');

    await expect(ConfigLoader.load('glooit.config.js')).rejects.toThrow('Config.rules must be an array');

    if (existsSync('glooit.config.js')) {
      unlinkSync('glooit.config.js');
    }
    process.chdir('..');
  });
});
