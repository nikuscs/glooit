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
    mkdirSync('.agents', { recursive: true });
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
      file: '.agents/test.md',
      to: './',
      targets: ['claude']
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config);
      writeFileSync('.agents/test.md', '# Test');

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      expect(existsSync('.gitignore')).toBe(true);
      const gitignoreContent = readFileSync('.gitignore', 'utf-8');
      expect(gitignoreContent).toContain('# glooit generated files');
      expect(gitignoreContent).toContain('CLAUDE.md');
      // Gitignore paths should NOT have "./" prefix
      expect(gitignoreContent).not.toContain('./CLAUDE.md');
    });

    it('should respect global gitignore: false', () => {
      const config = `
export default {
  gitignore: false,
  rules: [
    {
      file: '.agents/test.md',
      to: './',
      targets: ['claude']
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config);
      writeFileSync('.agents/test.md', '# Test');

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      // .gitignore should not be created or should be empty
      if (existsSync('.gitignore')) {
        const gitignoreContent = readFileSync('.gitignore', 'utf-8');
        expect(gitignoreContent).not.toContain('CLAUDE.md');
      }
    });

    it('should respect per-rule gitignore: false', () => {
      const config = `
export default {
  rules: [
    {
      file: '.agents/ignored.md',
      to: './',
      targets: ['claude']
    },
    {
      file: '.agents/not-ignored.md',
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
      writeFileSync('.agents/ignored.md', '# Ignored');
      writeFileSync('.agents/not-ignored.md', '# Not ignored');

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      expect(existsSync('.gitignore')).toBe(true);
      const gitignoreContent = readFileSync('.gitignore', 'utf-8');

      // Should contain the ignored file
      expect(gitignoreContent).toContain('CLAUDE.md');

      // Should NOT contain the not-ignored file
      expect(gitignoreContent).not.toContain('custom-output.md');
    });

    it('should handle mixed gitignore settings', () => {
      const config = `
export default {
  gitignore: true,
  rules: [
    {
      file: '.agents/rule1.md',
      to: './',
      targets: ['claude']
    },
    {
      file: '.agents/rule2.md',
      to: './',
      gitignore: false,
      targets: [
        { name: 'cursor', to: './rule2-output.md' }
      ]
    },
    {
      file: '.agents/rule3.md',
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
      writeFileSync('.agents/rule1.md', '# Rule 1');
      writeFileSync('.agents/rule2.md', '# Rule 2');
      writeFileSync('.agents/rule3.md', '# Rule 3');

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      const gitignoreContent = readFileSync('.gitignore', 'utf-8');

      expect(gitignoreContent).toContain('CLAUDE.md');
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
      file: ['.agents/part1.md', '.agents/part2.md'],
      to: './',
      targets: [
        { name: 'claude', to: './merged.md' }
      ]
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config);
      writeFileSync('.agents/part1.md', '# Part 1\n\nContent from part 1');
      writeFileSync('.agents/part2.md', '# Part 2\n\nContent from part 2');

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      expect(existsSync('./merged.md')).toBe(true);
      const mergedContent = readFileSync('./merged.md', 'utf-8');

      // Should NOT contain source markers (removed for cleaner output)
      expect(mergedContent).not.toContain('<!-- Source:');

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
        '.agents/intro.md',
        '.agents/body.md',
        '.agents/conclusion.md'
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
      writeFileSync('.agents/intro.md', '# Introduction');
      writeFileSync('.agents/body.md', '# Main Content');
      writeFileSync('.agents/conclusion.md', '# Conclusion');

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      const mergedContent = readFileSync('./complete.md', 'utf-8');

      // Should NOT contain source markers (removed for cleaner output)
      expect(mergedContent).not.toContain('<!-- Source:');

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
      file: ['.agents/part1.md', '.agents/part2.md'],
      to: './',
      targets: ['claude']
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config);
      writeFileSync('.agents/part1.md', '# Part 1');
      writeFileSync('.agents/part2.md', '# Part 2');

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
      file: ['.agents/part1.md', '.agents/part2.md'],
      to: './',
      gitignore: false,
      targets: [
        { name: 'claude', to: './merged-no-ignore.md' }
      ]
    },
    {
      file: ['.agents/part3.md', '.agents/part4.md'],
      to: './',
      targets: [
        { name: 'cursor', to: './merged-ignored.md' }
      ]
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config);
      writeFileSync('.agents/part1.md', '# Part 1');
      writeFileSync('.agents/part2.md', '# Part 2');
      writeFileSync('.agents/part3.md', '# Part 3');
      writeFileSync('.agents/part4.md', '# Part 4');

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

  describe('Auto-Prune', () => {
    it('should remove stale files when config changes', () => {
      // First sync with claude target
      const config1 = `
export default {
  rules: [
    {
      file: '.agents/test.md',
      to: './',
      targets: ['claude']
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config1);
      writeFileSync('.agents/test.md', '# Test');

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      expect(existsSync('CLAUDE.md')).toBe(true);

      // Now change config to cursor only
      const config2 = `
export default {
  rules: [
    {
      file: '.agents/test.md',
      to: './',
      targets: ['cursor']
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config2);
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      // CLAUDE.md should be pruned, cursor file should exist
      expect(existsSync('CLAUDE.md')).toBe(false);
      expect(existsSync('.cursor/rules/test.mdc')).toBe(true);
    });

    it('should skip non-existent directories gracefully', () => {
      const config = `
export default {
  skills: '.agents/skills',
  commands: '.agents/commands',
  rules: [
    {
      file: '.agents/test.md',
      to: './',
      targets: ['claude']
    }
  ]
};
`;
      writeFileSync('glooit.config.js', config);
      writeFileSync('.agents/test.md', '# Test');
      // Note: .agents/skills and .agents/commands don't exist

      const cliPath = `${originalCwd}/src/cli/index.ts`;

      // Should NOT throw - just skip the missing directories
      expect(() => {
        execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });
      }).not.toThrow();

      // Main rule should still work
      expect(existsSync('CLAUDE.md')).toBe(true);
    });
  });
});
