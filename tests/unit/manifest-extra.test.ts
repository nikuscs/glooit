import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { ManifestManager } from '../../src/core/manifest';

const testDir = 'test-manifest-extra';

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

describe('ManifestManager extra coverage', () => {
  it('defaults missing manifest fields', () => {
    mkdirSync('.agents', { recursive: true });
    writeFileSync('.agents/manifest.json', JSON.stringify({ version: 2 }, null, 2));

    const manager = new ManifestManager('.agents');
    const manifest = (manager as unknown as { readManifest: () => { generatedFiles: string[]; generatedDirectories: string[]; generatedSymlinks: string[] } })
      .readManifest();

    expect(manifest.generatedFiles).toEqual([]);
    expect(manifest.generatedDirectories).toEqual([]);
    expect(manifest.generatedSymlinks).toEqual([]);
  });

  it('prunes stale empty directories from manifest', () => {
    mkdirSync('.agents', { recursive: true });
    writeFileSync(
      '.agents/manifest.json',
      JSON.stringify({ version: 2, generatedFiles: [], generatedDirectories: ['stale-dir'], generatedSymlinks: [] }, null, 2)
    );

    mkdirSync('stale-dir', { recursive: true });

    const manager = new ManifestManager('.agents');
    const removed = manager.pruneStaleFiles([]);

    expect(removed).toContain('stale-dir/');
    expect(existsSync('stale-dir')).toBe(false);
  });

  it('normalizes directory paths when pruning', () => {
    mkdirSync('.agents', { recursive: true });
    writeFileSync(
      '.agents/manifest.json',
      JSON.stringify({ version: 2, generatedFiles: [], generatedDirectories: [], generatedSymlinks: [] }, null, 2)
    );

    const manager = new ManifestManager('.agents');
    const removed = manager.pruneStaleFiles(['dir/']);

    expect(removed).toEqual([]);
  });
});
