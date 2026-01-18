import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync, unlinkSync, readFileSync } from 'fs';
import { ManifestManager } from '../../src/core/manifest';

describe('ManifestManager', () => {
  const testDir = 'test-manifest';

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir('..');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('updateManifest and getGeneratedFiles', () => {
    it('should store and retrieve generated files', () => {
      const manager = new ManifestManager();

      manager.updateManifest(['CLAUDE.md', 'AGENTS.md', '.cursor/rules/'], ['linked.md']);

      expect(manager.getGeneratedFiles()).toEqual(['AGENTS.md', 'CLAUDE.md']);
      expect(manager.getGeneratedDirectories()).toEqual(['.cursor/rules']);
      expect(manager.getGeneratedSymlinks()).toEqual(['linked.md']);
    });

    it('should normalize paths by removing ./ prefix', () => {
      const manager = new ManifestManager();

      manager.updateManifest(['./CLAUDE.md', './.cursor/rules/']);

      expect(manager.getGeneratedFiles()).toEqual(['CLAUDE.md']);
      expect(manager.getGeneratedDirectories()).toEqual(['.cursor/rules']);
    });

    it('should persist manifest to file', () => {
      const manager = new ManifestManager();

      manager.updateManifest(['CLAUDE.md'], ['linked.md']);

      expect(existsSync('.agents/manifest.json')).toBe(true);
      const content = JSON.parse(readFileSync('.agents/manifest.json', 'utf-8'));
      expect(content.generatedFiles).toEqual(['CLAUDE.md']);
      expect(content.generatedSymlinks).toEqual(['linked.md']);
    });
  });

  describe('pruneStaleFiles', () => {
    it('should remove files no longer in config', () => {
      const manager = new ManifestManager();

      // Simulate previous sync that created these files
      writeFileSync('OLD_FILE.md', '# Old content');
      writeFileSync('CLAUDE.md', '# Claude content');
      manager.updateManifest(['OLD_FILE.md', 'CLAUDE.md']);

      // Now sync with only CLAUDE.md
      const removed = manager.pruneStaleFiles(['CLAUDE.md']);

      expect(removed).toContain('OLD_FILE.md');
      expect(existsSync('OLD_FILE.md')).toBe(false);
      expect(existsSync('CLAUDE.md')).toBe(true);
    });

    it('should not remove files that are still in config', () => {
      const manager = new ManifestManager();

      writeFileSync('CLAUDE.md', '# Claude content');
      manager.updateManifest(['CLAUDE.md']);

      const removed = manager.pruneStaleFiles(['CLAUDE.md']);

      expect(removed).toEqual([]);
      expect(existsSync('CLAUDE.md')).toBe(true);
    });

    it('should handle files that no longer exist gracefully', () => {
      const manager = new ManifestManager();

      // Track a file that doesn't exist anymore
      manager.updateManifest(['NONEXISTENT.md']);

      // Should not throw
      const removed = manager.pruneStaleFiles([]);

      expect(removed).toEqual([]);
    });

    it('should remove empty directories', () => {
      const manager = new ManifestManager();

      mkdirSync('.cursor/rules', { recursive: true });
      manager.updateManifest(['.cursor/rules/']);

      const removed = manager.pruneStaleFiles([]);

      expect(removed).toContain('.cursor/rules/');
      expect(existsSync('.cursor/rules')).toBe(false);
    });

    it('should not remove non-empty directories', () => {
      const manager = new ManifestManager();

      mkdirSync('.cursor/rules', { recursive: true });
      writeFileSync('.cursor/rules/user-file.md', '# User content');
      manager.updateManifest(['.cursor/rules/']);

      manager.pruneStaleFiles([]);

      // Directory should remain because it has content not managed by glooit
      expect(existsSync('.cursor/rules')).toBe(true);
      expect(existsSync('.cursor/rules/user-file.md')).toBe(true);
    });
  });

  describe('clearManifest', () => {
    it('should remove the manifest file', () => {
      const manager = new ManifestManager();

      manager.updateManifest(['CLAUDE.md']);
      expect(existsSync('.agents/manifest.json')).toBe(true);

      manager.clearManifest();
      expect(existsSync('.agents/manifest.json')).toBe(false);
    });

    it('should handle missing manifest gracefully', () => {
      const manager = new ManifestManager();

      // Should not throw
      expect(() => manager.clearManifest()).not.toThrow();
    });
  });

  describe('edge cases - bulletproof handling', () => {
    it('should handle corrupted manifest JSON gracefully', () => {
      mkdirSync('.agents', { recursive: true });
      writeFileSync('.agents/manifest.json', '{ invalid json !!!');

      const manager = new ManifestManager();

      // Should not throw, returns empty arrays
      expect(manager.getGeneratedFiles()).toEqual([]);
      expect(manager.getGeneratedDirectories()).toEqual([]);

      // Sync should still work - creates new valid manifest
      manager.updateManifest(['CLAUDE.md']);
      expect(manager.getGeneratedFiles()).toEqual(['CLAUDE.md']);
    });

    it('should work on first run with no manifest', () => {
      const manager = new ManifestManager();

      // No manifest exists yet
      expect(existsSync('.agents/manifest.json')).toBe(false);

      // Prune should work (nothing to prune)
      const removed = manager.pruneStaleFiles(['CLAUDE.md']);
      expect(removed).toEqual([]);

      // Update should create manifest
      manager.updateManifest(['CLAUDE.md']);
      expect(existsSync('.agents/manifest.json')).toBe(true);
    });

    it('should recover if user deletes manifest between syncs', () => {
      const manager = new ManifestManager();

      // First sync
      writeFileSync('CLAUDE.md', '# Content');
      manager.updateManifest(['CLAUDE.md']);

      // User deletes manifest
      unlinkSync('.agents/manifest.json');

      // Second sync with different config - won't prune because no history
      const removed = manager.pruneStaleFiles(['AGENTS.md']);
      expect(removed).toEqual([]); // CLAUDE.md not pruned (no record of it)

      // But manifest is rebuilt for next time
      manager.updateManifest(['AGENTS.md']);
      expect(manager.getGeneratedFiles()).toEqual(['AGENTS.md']);
    });

    it('should handle manifest with files that were manually deleted', () => {
      const manager = new ManifestManager();

      // Manifest says these exist, but they don't
      manager.updateManifest(['DELETED.md', 'ALSO_DELETED.md']);

      // Prune should not throw - files don't exist anymore
      const removed = manager.pruneStaleFiles([]);
      expect(removed).toEqual([]); // Nothing actually removed (already gone)
    });

    it('should not delete files outside of manifest tracking', () => {
      const manager = new ManifestManager();

      // Create a user file that glooit didn't create
      writeFileSync('USER_FILE.md', '# User content');

      // Manifest only tracks CLAUDE.md
      writeFileSync('CLAUDE.md', '# Claude content');
      manager.updateManifest(['CLAUDE.md']);

      // Change config to nothing
      manager.pruneStaleFiles([]);

      // CLAUDE.md should be removed, but USER_FILE.md should remain
      expect(existsSync('CLAUDE.md')).toBe(false);
      expect(existsSync('USER_FILE.md')).toBe(true);
    });
  });
});
