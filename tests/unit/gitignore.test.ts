import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { GitIgnoreManager } from '../../src/core/gitignore';
import type { Config, SingleFileRule, MergedFileRule } from '../../src/types';

describe('GitIgnoreManager', () => {
  const testDir = 'test-gitignore';

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

  describe('updateGitIgnore', () => {
    it('should create .gitignore with generated files', async () => {
      const rule: SingleFileRule = {
        file: 'test.md',
        to: './',
        targets: ['claude']
      };

      const config: Config = {
        rules: [rule],
        mergeMcps: true
      };

      const manager = new GitIgnoreManager(config);
      await manager.updateGitIgnore();

      expect(existsSync('.gitignore')).toBe(true);
      const content = readFileSync('.gitignore', 'utf-8');

      expect(content).toContain('# glooit generated files');
      expect(content).toContain('./CLAUDE.md');
    });

    it('should not create .gitignore when global gitignore is false', async () => {
      const rule: SingleFileRule = {
        file: 'test.md',
        to: './',
        targets: ['claude']
      };

      const config: Config = {
        gitignore: false,
        rules: [rule],
        mergeMcps: true
      };

      const manager = new GitIgnoreManager(config);
      await manager.updateGitIgnore();

      if (existsSync('.gitignore')) {
        const content = readFileSync('.gitignore', 'utf-8');
        expect(content).not.toContain('./CLAUDE.md');
      }
    });

    it('should skip rules with gitignore: false', async () => {
      const rule1: SingleFileRule = {
        file: 'test1.md',
        to: './',
        targets: ['claude']
      };

      const rule2: SingleFileRule = {
        file: 'test2.md',
        to: './',
        gitignore: false,
        targets: [
          { name: 'cursor', to: './custom-output.md' }
        ]
      };

      const config: Config = {
        rules: [rule1, rule2],
        mergeMcps: true
      };

      const manager = new GitIgnoreManager(config);
      await manager.updateGitIgnore();

      const content = readFileSync('.gitignore', 'utf-8');

      expect(content).toContain('./CLAUDE.md');
      expect(content).not.toContain('custom-output.md');
    });

    it('should handle mixed gitignore settings', async () => {
      const rule1: SingleFileRule = {
        file: 'test1.md',
        to: './',
        targets: ['claude']
      };

      const rule2: SingleFileRule = {
        file: 'test2.md',
        to: './',
        gitignore: false,
        targets: [
          { name: 'cursor', to: './not-ignored.md' }
        ]
      };

      const rule3: SingleFileRule = {
        file: 'test3.md',
        to: './',
        gitignore: true,
        targets: [
          { name: 'codex', to: './ignored.md' }
        ]
      };

      const config: Config = {
        gitignore: true,
        rules: [rule1, rule2, rule3],
        mergeMcps: true
      };

      const manager = new GitIgnoreManager(config);
      await manager.updateGitIgnore();

      const content = readFileSync('.gitignore', 'utf-8');

      expect(content).toContain('./CLAUDE.md');
      expect(content).toContain('ignored.md');
      expect(content).not.toContain('not-ignored.md');
    });

    it('should update existing .gitignore', async () => {
      // Create initial .gitignore
      writeFileSync('.gitignore', 'node_modules/\n.env\n');

      const rule: SingleFileRule = {
        file: 'test.md',
        to: './',
        targets: ['claude']
      };

      const config: Config = {
        rules: [rule],
        mergeMcps: true
      };

      const manager = new GitIgnoreManager(config);
      await manager.updateGitIgnore();

      const content = readFileSync('.gitignore', 'utf-8');

      // Should preserve existing entries
      expect(content).toContain('node_modules/');
      expect(content).toContain('.env');

      // Should add new entries
      expect(content).toContain('# glooit generated files');
      expect(content).toContain('./CLAUDE.md');
    });

    it('should replace existing glooit section', async () => {
      // Create .gitignore with old glooit section
      const initialContent = `node_modules/
.env

# glooit generated files
./OLD_FILE.md
./ANOTHER_OLD.md

other-file.txt`;

      writeFileSync('.gitignore', initialContent);

      const rule: SingleFileRule = {
        file: 'new.md',
        to: './',
        targets: ['claude']
      };

      const config: Config = {
        rules: [rule],
        mergeMcps: true
      };

      const manager = new GitIgnoreManager(config);
      await manager.updateGitIgnore();

      const content = readFileSync('.gitignore', 'utf-8');

      // Should preserve non-glooit entries
      expect(content).toContain('node_modules/');
      expect(content).toContain('.env');
      expect(content).toContain('other-file.txt');

      // Should remove old glooit entries
      expect(content).not.toContain('OLD_FILE.md');
      expect(content).not.toContain('ANOTHER_OLD.md');

      // Should add new glooit entries
      expect(content).toContain('# glooit generated files');
      expect(content).toContain('./CLAUDE.md');
    });

    it('should handle multiple targets for single rule', async () => {
      const rule: SingleFileRule = {
        file: 'shared.md',
        to: './',
        targets: ['claude', 'cursor', 'codex']
      };

      const config: Config = {
        rules: [rule],
        mergeMcps: true
      };

      const manager = new GitIgnoreManager(config);
      await manager.updateGitIgnore();

      const content = readFileSync('.gitignore', 'utf-8');

      expect(content).toContain('./CLAUDE.md');
      expect(content).toContain('.cursor/');
      expect(content).toContain('./AGENTS.md'); // codex uses AGENTS.md
    });

    it('should handle custom paths', async () => {
      const rule: SingleFileRule = {
        file: 'test.md',
        to: './',
        targets: [
          { name: 'claude', to: './custom/path/output.md' }
        ]
      };

      const config: Config = {
        rules: [rule],
        mergeMcps: true
      };

      const manager = new GitIgnoreManager(config);
      await manager.updateGitIgnore();

      const content = readFileSync('.gitignore', 'utf-8');

      expect(content).toContain('./custom/path/output.md');
    });

    it('should handle merged files in gitignore', async () => {
      const rule: MergedFileRule = {
        file: ['part1.md', 'part2.md'],
        to: './',
        targets: [
          { name: 'claude', to: './merged-output.md' }
        ]
      };

      const config: Config = {
        rules: [rule],
        mergeMcps: true
      };

      const manager = new GitIgnoreManager(config);
      await manager.updateGitIgnore();

      const content = readFileSync('.gitignore', 'utf-8');

      expect(content).toContain('merged-output.md');
    });

    it('should not add merged files with gitignore: false', async () => {
      const rule: MergedFileRule = {
        file: ['part1.md', 'part2.md'],
        to: './',
        gitignore: false,
        targets: [
          { name: 'claude', to: './merged-no-ignore.md' }
        ]
      };

      const config: Config = {
        rules: [rule],
        mergeMcps: true
      };

      const manager = new GitIgnoreManager(config);
      await manager.updateGitIgnore();

      if (existsSync('.gitignore')) {
        const content = readFileSync('.gitignore', 'utf-8');
        expect(content).not.toContain('merged-no-ignore.md');
      }
    });
  });

  describe('cleanupGitIgnore', () => {
    it('should remove glooit section from .gitignore', async () => {
      const initialContent = `node_modules/
.env

# glooit generated files
./CLAUDE.md
./CURSOR.md

other-file.txt`;

      writeFileSync('.gitignore', initialContent);

      const config: Config = {
        rules: [],
        mergeMcps: true
      };

      const manager = new GitIgnoreManager(config);
      await manager.cleanupGitIgnore();

      const content = readFileSync('.gitignore', 'utf-8');

      // Should preserve non-glooit entries
      expect(content).toContain('node_modules/');
      expect(content).toContain('.env');
      expect(content).toContain('other-file.txt');

      // Should remove glooit section
      expect(content).not.toContain('# glooit generated files');
      expect(content).not.toContain('./CLAUDE.md');
      expect(content).not.toContain('./CURSOR.md');
    });

    it('should handle missing .gitignore gracefully', async () => {
      const config: Config = {
        rules: [],
        mergeMcps: true
      };

      const manager = new GitIgnoreManager(config);

      // Should not throw - just resolves successfully
      await expect(manager.cleanupGitIgnore()).resolves.toBeUndefined();
    });
  });
});
