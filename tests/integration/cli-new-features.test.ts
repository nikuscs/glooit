import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

describe('CLI - New Features (Gitignore Control & File Merge)', () => {
  const testDir = 'test-cli-new-features';
  const originalCwd = process.cwd();

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
    mkdirSync('.glooit', { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('Gitignore Control', () => {
    it('should add generated files to .gitignore by default', () => {
      const config = `
export default {
  rules: [
    {
      file: '.glooit/test.md',
      to: './',
      targets: ['claude']
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config);
      writeFileSync('.glooit/test.md', '# Test');

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      expect(existsSync('.gitignore')).toBe(true);
      const gitignoreContent = readFileSync('.gitignore', 'utf-8');
      expect(gitignoreContent).toContain('# glooit generated files');
      expect(gitignoreContent).toContain('./CLAUDE.md');
    });

    it('should respect global gitignore: false', () => {
      const config = `
export default {
  gitignore: false,
  rules: [
    {
      file: '.glooit/test.md',
      to: './',
      targets: ['claude']
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config);
      writeFileSync('.glooit/test.md', '# Test');

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      // .gitignore should not be created or should be empty
      if (existsSync('.gitignore')) {
        const gitignoreContent = readFileSync('.gitignore', 'utf-8');
        expect(gitignoreContent).not.toContain('./CLAUDE.md');
      }
    });

    it('should respect per-rule gitignore: false', () => {
      const config = `
export default {
  rules: [
    {
      file: '.glooit/ignored.md',
      to: './',
      targets: ['claude']
    },
    {
      file: '.glooit/not-ignored.md',
      to: './',
      gitignore: false,
      targets: [
        { name: 'cursor', to: './custom-output.md' }
      ]
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config);
      writeFileSync('.glooit/ignored.md', '# Ignored');
      writeFileSync('.glooit/not-ignored.md', '# Not ignored');

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      expect(existsSync('.gitignore')).toBe(true);
      const gitignoreContent = readFileSync('.gitignore', 'utf-8');

      // Should contain the ignored file
      expect(gitignoreContent).toContain('./CLAUDE.md');

      // Should NOT contain the not-ignored file
      expect(gitignoreContent).not.toContain('custom-output.md');
    });

    it('should handle mixed gitignore settings', () => {
      const config = `
export default {
  gitignore: true,
  rules: [
    {
      file: '.glooit/rule1.md',
      to: './',
      targets: ['claude']
    },
    {
      file: '.glooit/rule2.md',
      to: './',
      gitignore: false,
      targets: [
        { name: 'cursor', to: './rule2-output.md' }
      ]
    },
    {
      file: '.glooit/rule3.md',
      to: './',
      gitignore: true,
      targets: [
        { name: 'codex', to: './rule3-output.md' }
      ]
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config);
      writeFileSync('.glooit/rule1.md', '# Rule 1');
      writeFileSync('.glooit/rule2.md', '# Rule 2');
      writeFileSync('.glooit/rule3.md', '# Rule 3');

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      const gitignoreContent = readFileSync('.gitignore', 'utf-8');

      expect(gitignoreContent).toContain('./CLAUDE.md');
      expect(gitignoreContent).toContain('rule3-output.md');
      expect(gitignoreContent).not.toContain('rule2-output.md');
    });
  });

  describe('File Merge', () => {
    it('should merge multiple files with markers and separators', () => {
      const config = `
export default {
  rules: [
    {
      file: ['.glooit/part1.md', '.glooit/part2.md'],
      to: './',
      targets: [
        { name: 'claude', to: './merged.md' }
      ]
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config);
      writeFileSync('.glooit/part1.md', '# Part 1\n\nContent from part 1');
      writeFileSync('.glooit/part2.md', '# Part 2\n\nContent from part 2');

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      expect(existsSync('./merged.md')).toBe(true);
      const mergedContent = readFileSync('./merged.md', 'utf-8');

      // Should contain source markers
      expect(mergedContent).toContain('<!-- Source: .glooit/part1.md -->');
      expect(mergedContent).toContain('<!-- Source: .glooit/part2.md -->');

      // Should contain separator
      expect(mergedContent).toContain('---');

      // Should contain both file contents
      expect(mergedContent).toContain('# Part 1');
      expect(mergedContent).toContain('Content from part 1');
      expect(mergedContent).toContain('# Part 2');
      expect(mergedContent).toContain('Content from part 2');

      // Verify order
      const part1Index = mergedContent.indexOf('# Part 1');
      const part2Index = mergedContent.indexOf('# Part 2');
      expect(part1Index).toBeLessThan(part2Index);
    });

    it('should merge three or more files correctly', () => {
      const config = `
export default {
  rules: [
    {
      file: [
        '.glooit/intro.md',
        '.glooit/body.md',
        '.glooit/conclusion.md'
      ],
      to: './',
      targets: [
        { name: 'claude', to: './complete.md' }
      ]
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config);
      writeFileSync('.glooit/intro.md', '# Introduction');
      writeFileSync('.glooit/body.md', '# Main Content');
      writeFileSync('.glooit/conclusion.md', '# Conclusion');

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      const mergedContent = readFileSync('./complete.md', 'utf-8');

      // Check all markers present
      expect(mergedContent).toContain('<!-- Source: .glooit/intro.md -->');
      expect(mergedContent).toContain('<!-- Source: .glooit/body.md -->');
      expect(mergedContent).toContain('<!-- Source: .glooit/conclusion.md -->');

      // Check content order
      const introIdx = mergedContent.indexOf('# Introduction');
      const bodyIdx = mergedContent.indexOf('# Main Content');
      const conclusionIdx = mergedContent.indexOf('# Conclusion');

      expect(introIdx).toBeLessThan(bodyIdx);
      expect(bodyIdx).toBeLessThan(conclusionIdx);

      // Should have 2 separators (between 3 files)
      const separatorCount = (mergedContent.match(/\n---\n/g) || []).length;
      expect(separatorCount).toBe(2);
    });

    it('should require object targets for merged files', () => {
      const config = `
export default {
  rules: [
    {
      file: ['.glooit/part1.md', '.glooit/part2.md'],
      to: './',
      targets: ['claude']
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config);
      writeFileSync('.glooit/part1.md', '# Part 1');
      writeFileSync('.glooit/part2.md', '# Part 2');

      const cliPath = `${originalCwd}/src/cli/index.ts`;

      expect(() => {
        execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });
      }).toThrow();
    });

    it('should work with merge and gitignore control together', () => {
      const config = `
export default {
  rules: [
    {
      file: ['.glooit/part1.md', '.glooit/part2.md'],
      to: './',
      gitignore: false,
      targets: [
        { name: 'claude', to: './merged-no-ignore.md' }
      ]
    },
    {
      file: ['.glooit/part3.md', '.glooit/part4.md'],
      to: './',
      targets: [
        { name: 'cursor', to: './merged-ignored.md' }
      ]
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config);
      writeFileSync('.glooit/part1.md', '# Part 1');
      writeFileSync('.glooit/part2.md', '# Part 2');
      writeFileSync('.glooit/part3.md', '# Part 3');
      writeFileSync('.glooit/part4.md', '# Part 4');

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      // Both files should exist
      expect(existsSync('./merged-no-ignore.md')).toBe(true);
      expect(existsSync('./merged-ignored.md')).toBe(true);

      // Check merged content
      const content1 = readFileSync('./merged-no-ignore.md', 'utf-8');
      expect(content1).toContain('# Part 1');
      expect(content1).toContain('# Part 2');

      const content2 = readFileSync('./merged-ignored.md', 'utf-8');
      expect(content2).toContain('# Part 3');
      expect(content2).toContain('# Part 4');

      // Check gitignore
      const gitignoreContent = readFileSync('.gitignore', 'utf-8');
      expect(gitignoreContent).not.toContain('merged-no-ignore.md');
      expect(gitignoreContent).toContain('merged-ignored.md');
    });
  });
});
