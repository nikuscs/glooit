import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { AgentDistributor } from '../../src/agents/distributor';
import type { Config, MergedFileRule, SingleFileRule } from '../../src/types';

describe('AgentDistributor - File Merge', () => {
  const testDir = 'test-file-merge';

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('loadRuleContent (via distributeRule)', () => {
    it('should handle single file correctly', async () => {
      const testFile = `${testDir}/single.md`;
      writeFileSync(testFile, '# Single File\n\nThis is a single file.');

      const config: Config = {
        rules: [],
        mergeMcps: true
      };

      const rule: SingleFileRule = {
        file: testFile,
        to: testDir,
        targets: [
          { name: 'claude', to: `${testDir}/output.md` }
        ]
      };

      const distributor = new AgentDistributor(config);
      await distributor.distributeRule(rule);

      const outputContent = readFileSync(`${testDir}/output.md`, 'utf-8');
      expect(outputContent).toContain('# Single File');
      expect(outputContent).toContain('This is a single file.');
      expect(outputContent).not.toContain('<!-- Source:');
      expect(outputContent).not.toContain('---');
    });

    it('should merge two files with separator (no source markers)', async () => {
      const file1 = `${testDir}/part1.md`;
      const file2 = `${testDir}/part2.md`;

      writeFileSync(file1, '# Part 1\n\nContent from part 1');
      writeFileSync(file2, '# Part 2\n\nContent from part 2');

      const config: Config = {
        rules: [],
        mergeMcps: true
      };

      const rule: MergedFileRule = {
        file: [file1, file2],
        to: testDir,
        targets: [
          { name: 'claude', to: `${testDir}/merged.md` }
        ]
      };

      const distributor = new AgentDistributor(config);
      await distributor.distributeRule(rule);

      const mergedContent = readFileSync(`${testDir}/merged.md`, 'utf-8');

      // Should NOT have source markers (removed for cleaner output)
      expect(mergedContent).not.toContain('<!-- Source:');

      // Check for separator
      expect(mergedContent).toContain('\n---\n');

      // Check for content
      expect(mergedContent).toContain('# Part 1');
      expect(mergedContent).toContain('Content from part 1');
      expect(mergedContent).toContain('# Part 2');
      expect(mergedContent).toContain('Content from part 2');

      // Verify order
      const part1Index = mergedContent.indexOf('# Part 1');
      const part2Index = mergedContent.indexOf('# Part 2');
      expect(part1Index).toBeLessThan(part2Index);
    });

    it('skips empty file paths in merge lists', async () => {
      const file1 = `${testDir}/part1.md`;
      writeFileSync(file1, '# Part 1');

      const config: Config = {
        rules: [],
        mergeMcps: true
      };

      const rule: MergedFileRule = {
        file: ['', file1],
        to: testDir,
        targets: [
          { name: 'claude', to: `${testDir}/merged-skip.md` }
        ]
      };

      const distributor = new AgentDistributor(config);
      await distributor.distributeRule(rule);

      const mergedContent = readFileSync(`${testDir}/merged-skip.md`, 'utf-8');
      expect(mergedContent).toContain('# Part 1');
    });

    it('should merge three files with correct separators', async () => {
      const file1 = `${testDir}/intro.md`;
      const file2 = `${testDir}/body.md`;
      const file3 = `${testDir}/conclusion.md`;

      writeFileSync(file1, '# Introduction');
      writeFileSync(file2, '# Main Content');
      writeFileSync(file3, '# Conclusion');

      const config: Config = {
        rules: [],
        mergeMcps: true
      };

      const rule: MergedFileRule = {
        file: [file1, file2, file3],
        to: testDir,
        targets: [
          { name: 'claude', to: `${testDir}/complete.md` }
        ]
      };

      const distributor = new AgentDistributor(config);
      await distributor.distributeRule(rule);

      const mergedContent = readFileSync(`${testDir}/complete.md`, 'utf-8');

      // Should NOT have source markers
      expect(mergedContent).not.toContain('<!-- Source:');

      // Should have 2 separators (between 3 files)
      const separatorCount = (mergedContent.match(/\n---\n/g) || []).length;
      expect(separatorCount).toBe(2);

      // Check order
      const introIdx = mergedContent.indexOf('# Introduction');
      const bodyIdx = mergedContent.indexOf('# Main Content');
      const conclusionIdx = mergedContent.indexOf('# Conclusion');

      expect(introIdx).toBeLessThan(bodyIdx);
      expect(bodyIdx).toBeLessThan(conclusionIdx);
    });

    it('should preserve file content exactly', async () => {
      const file1 = `${testDir}/complex1.md`;
      const file2 = `${testDir}/complex2.md`;

      const content1 = `# Complex File 1

## Section 1.1
- Item A
- Item B

\`\`\`javascript
const x = 42;
\`\`\`

### Subsection
More text here.`;

      const content2 = `# Complex File 2

> This is a quote

1. Numbered item 1
2. Numbered item 2

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |`;

      writeFileSync(file1, content1);
      writeFileSync(file2, content2);

      const config: Config = {
        rules: [],
        mergeMcps: true
      };

      const rule: MergedFileRule = {
        file: [file1, file2],
        to: testDir,
        targets: [
          { name: 'claude', to: `${testDir}/complex-merged.md` }
        ]
      };

      const distributor = new AgentDistributor(config);
      await distributor.distributeRule(rule);

      const mergedContent = readFileSync(`${testDir}/complex-merged.md`, 'utf-8');

      // Check that all complex content is preserved
      expect(mergedContent).toContain('const x = 42;');
      expect(mergedContent).toContain('> This is a quote');
      expect(mergedContent).toContain('| Column 1 | Column 2 |');
      expect(mergedContent).toContain('### Subsection');
    });

    it('should handle empty files in merge', async () => {
      const file1 = `${testDir}/empty.md`;
      const file2 = `${testDir}/content.md`;

      writeFileSync(file1, '');
      writeFileSync(file2, '# Has Content');

      const config: Config = {
        rules: [],
        mergeMcps: true
      };

      const rule: MergedFileRule = {
        file: [file1, file2],
        to: testDir,
        targets: [
          { name: 'claude', to: `${testDir}/with-empty.md` }
        ]
      };

      const distributor = new AgentDistributor(config);
      await distributor.distributeRule(rule);

      const mergedContent = readFileSync(`${testDir}/with-empty.md`, 'utf-8');

      // Should NOT have source markers
      expect(mergedContent).not.toContain('<!-- Source:');

      // Should have the content from file2
      expect(mergedContent).toContain('# Has Content');
    });

    it('should throw error for non-existent file in array', async () => {
      const file1 = `${testDir}/exists.md`;
      writeFileSync(file1, '# Exists');

      const config: Config = {
        rules: [],
        mergeMcps: true
      };

      const rule: MergedFileRule = {
        file: [file1, 'non-existent.md'],
        to: testDir,
        targets: [
          { name: 'claude', to: `${testDir}/output.md` }
        ]
      };

      const distributor = new AgentDistributor(config);

      await expect(distributor.distributeRule(rule)).rejects.toThrow();
    });

    it('should work with multiple targets for merged files', async () => {
      const file1 = `${testDir}/part1.md`;
      const file2 = `${testDir}/part2.md`;

      writeFileSync(file1, '# Part 1');
      writeFileSync(file2, '# Part 2');

      const config: Config = {
        rules: [],
        mergeMcps: true
      };

      const rule: MergedFileRule = {
        file: [file1, file2],
        to: testDir,
        targets: [
          { name: 'claude', to: `${testDir}/merged-claude.md` },
          { name: 'cursor', to: `${testDir}/merged-cursor.md` }
        ]
      };

      const distributor = new AgentDistributor(config);
      await distributor.distributeRule(rule);

      // Both outputs should exist
      expect(existsSync(`${testDir}/merged-claude.md`)).toBe(true);
      expect(existsSync(`${testDir}/merged-cursor.md`)).toBe(true);

      // Both should have merged content
      const claudeContent = readFileSync(`${testDir}/merged-claude.md`, 'utf-8');
      const cursorContent = readFileSync(`${testDir}/merged-cursor.md`, 'utf-8');

      expect(claudeContent).toContain('# Part 1');
      expect(claudeContent).toContain('# Part 2');

      // Cursor has different formatting (frontmatter), but should have the content
      expect(cursorContent).toContain('# Part 1');
      expect(cursorContent).toContain('# Part 2');
    });

    it('should strip YAML frontmatter from merged files', async () => {
      const file1 = `${testDir}/with-frontmatter1.md`;
      const file2 = `${testDir}/with-frontmatter2.md`;

      writeFileSync(file1, `---
description: First file description
globs: "src/**/*"
---

# First File

Content from first file.`);

      writeFileSync(file2, `---
description: Second file description
globs: "lib/**/*"
---

# Second File

Content from second file.`);

      const config: Config = {
        rules: [],
        mergeMcps: true
      };

      const rule: MergedFileRule = {
        file: [file1, file2],
        to: testDir,
        globs: '**/*',
        targets: [
          { name: 'claude', to: `${testDir}/merged-no-frontmatter.md` }
        ]
      };

      const distributor = new AgentDistributor(config);
      await distributor.distributeRule(rule);

      const mergedContent = readFileSync(`${testDir}/merged-no-frontmatter.md`, 'utf-8');

      // Should NOT contain the source files' frontmatter content
      expect(mergedContent).not.toContain('description: First file description');
      expect(mergedContent).not.toContain('description: Second file description');
      expect(mergedContent).not.toContain('globs: "src/**/*"');
      expect(mergedContent).not.toContain('globs: "lib/**/*"');

      // Should contain the actual content
      expect(mergedContent).toContain('# First File');
      expect(mergedContent).toContain('Content from first file.');
      expect(mergedContent).toContain('# Second File');
      expect(mergedContent).toContain('Content from second file.');

      // Should have separator between files
      expect(mergedContent).toContain('\n---\n');

      // The separator should be the ONLY --- in the output (appears once between files)
      // Count occurrences of --- on its own line
      const separatorMatches = mergedContent.match(/\n---\n/g) || [];
      expect(separatorMatches.length).toBe(1);
    });

    it('should preserve frontmatter for single file (no merge)', async () => {
      const testFile = `${testDir}/single-with-frontmatter.md`;
      writeFileSync(testFile, `---
description: Single file with frontmatter
globs: "test/**/*"
---

# Single File

This file has frontmatter that should be preserved.`);

      const config: Config = {
        rules: [],
        mergeMcps: true
      };

      const rule: SingleFileRule = {
        file: testFile,
        to: testDir,
        targets: [
          { name: 'claude', to: `${testDir}/single-output.md` }
        ]
      };

      const distributor = new AgentDistributor(config);
      await distributor.distributeRule(rule);

      const outputContent = readFileSync(`${testDir}/single-output.md`, 'utf-8');

      // Single file should preserve its frontmatter (not stripped)
      expect(outputContent).toContain('description: Single file with frontmatter');
      expect(outputContent).toContain('globs: "test/**/*"');
      expect(outputContent).toContain('# Single File');
    });

    it('should handle mixed files (some with frontmatter, some without)', async () => {
      const file1 = `${testDir}/has-frontmatter.md`;
      const file2 = `${testDir}/no-frontmatter.md`;

      writeFileSync(file1, `---
description: Has frontmatter
---

# With Frontmatter

This file has frontmatter.`);

      writeFileSync(file2, `# Without Frontmatter

This file has no frontmatter.`);

      const config: Config = {
        rules: [],
        mergeMcps: true
      };

      const rule: MergedFileRule = {
        file: [file1, file2],
        to: testDir,
        targets: [
          { name: 'claude', to: `${testDir}/mixed-merge.md` }
        ]
      };

      const distributor = new AgentDistributor(config);
      await distributor.distributeRule(rule);

      const mergedContent = readFileSync(`${testDir}/mixed-merge.md`, 'utf-8');

      // Frontmatter should be stripped
      expect(mergedContent).not.toContain('description: Has frontmatter');

      // Content from both files should be present
      expect(mergedContent).toContain('# With Frontmatter');
      expect(mergedContent).toContain('This file has frontmatter.');
      expect(mergedContent).toContain('# Without Frontmatter');
      expect(mergedContent).toContain('This file has no frontmatter.');
    });

    it('should use rule.globs for Cursor output when merging files with frontmatter', async () => {
      const file1 = `${testDir}/cursor-test1.md`;
      const file2 = `${testDir}/cursor-test2.md`;

      writeFileSync(file1, `---
description: File 1 for Cursor
globs: "file1/**/*"
---

# File 1 Content`);

      writeFileSync(file2, `---
description: File 2 for Cursor
globs: "file2/**/*"
---

# File 2 Content`);

      const config: Config = {
        rules: [],
        mergeMcps: true
      };

      const rule: MergedFileRule = {
        file: [file1, file2],
        to: testDir,
        globs: 'merged/**/*',
        targets: [
          { name: 'cursor', to: `${testDir}/cursor-merged.md` }
        ]
      };

      const distributor = new AgentDistributor(config);
      await distributor.distributeRule(rule);

      const cursorContent = readFileSync(`${testDir}/cursor-merged.md`, 'utf-8');

      // Should have Cursor's generated frontmatter with rule.globs
      expect(cursorContent).toContain('globs: merged/**/*');

      // Should NOT have the source files' globs
      expect(cursorContent).not.toContain('globs: "file1/**/*"');
      expect(cursorContent).not.toContain('globs: "file2/**/*"');

      // Should have the content
      expect(cursorContent).toContain('# File 1 Content');
      expect(cursorContent).toContain('# File 2 Content');
    });
  });
});
