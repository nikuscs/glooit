import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

describe('CLI - Directory Sync', () => {
  const testDir = 'test-cli-directory-sync';
  const originalCwd = process.cwd();

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it('should sync commands directory to claude and cursor', () => {
    // Create commands directory with files
    mkdirSync('.agents/commands', { recursive: true });
    writeFileSync('.agents/commands/deploy.md', '# Deploy Command\nDeploy the application');
    writeFileSync('.agents/commands/test.md', '# Test Command\nRun tests');

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'commands',
      file: '.agents/commands',
      targets: ['claude', 'cursor']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    const result = execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(result).toContain('✅ Sync completed!');

    // Check Claude commands
    expect(existsSync('.claude/commands/deploy.md')).toBe(true);
    expect(existsSync('.claude/commands/test.md')).toBe(true);
    expect(readFileSync('.claude/commands/deploy.md', 'utf-8')).toContain('# Deploy Command');

    // Check Cursor commands
    expect(existsSync('.cursor/commands/deploy.md')).toBe(true);
    expect(existsSync('.cursor/commands/test.md')).toBe(true);
    expect(readFileSync('.cursor/commands/deploy.md', 'utf-8')).toContain('# Deploy Command');
  });

  it('should derive directory type from folder name when name is not specified', () => {
    // Create commands directory
    mkdirSync('.agents/commands', { recursive: true });
    writeFileSync('.agents/commands/hello.md', '# Hello');

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      file: '.agents/commands',
      to: './',
      targets: ['claude']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.claude/commands/hello.md')).toBe(true);
  });

  it('should preserve nested directory structure', () => {
    // Create nested commands
    mkdirSync('.agents/commands/dev', { recursive: true });
    mkdirSync('.agents/commands/prod', { recursive: true });
    writeFileSync('.agents/commands/dev/start.md', '# Dev Start');
    writeFileSync('.agents/commands/prod/deploy.md', '# Prod Deploy');

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'commands',
      file: '.agents/commands',
      targets: ['claude']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.claude/commands/dev/start.md')).toBe(true);
    expect(existsSync('.claude/commands/prod/deploy.md')).toBe(true);
  });

  it('should apply hooks to markdown files in directory', () => {
    mkdirSync('.agents/commands', { recursive: true });
    writeFileSync('.agents/commands/info.md', '# Info\nTimestamp: __TIMESTAMP__');

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'commands',
      file: '.agents/commands',
      targets: ['claude'],
      hooks: ['addTimestamp']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    const content = readFileSync('.claude/commands/info.md', 'utf-8');
    expect(content).not.toContain('__TIMESTAMP__');
    // Timestamp format: "December 28, 2025 at 06:22 PM"
    expect(content).toMatch(/Timestamp: \w+ \d{1,2}, \d{4} at \d{2}:\d{2} (AM|PM)/);
  });

  it('should copy non-markdown files as-is', () => {
    mkdirSync('.agents/commands', { recursive: true });
    writeFileSync('.agents/commands/script.sh', '#!/bin/bash\necho "hello"');
    writeFileSync('.agents/commands/readme.txt', 'Some text file');

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'commands',
      file: '.agents/commands',
      targets: ['claude']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.claude/commands/script.sh')).toBe(true);
    expect(existsSync('.claude/commands/readme.txt')).toBe(true);
    expect(readFileSync('.claude/commands/script.sh', 'utf-8')).toBe('#!/bin/bash\necho "hello"');
  });

  it('should error when targeting unsupported agent without explicit to', () => {
    mkdirSync('.agents/commands', { recursive: true });
    writeFileSync('.agents/commands/test.md', '# Test');

    // roocode doesn't support commands directory
    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'commands',
      file: '.agents/commands',
      targets: ['roocode']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;

    expect(() => {
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8', stdio: 'pipe' });
    }).toThrow();
  });

  it('should allow custom to path for unsupported agents', () => {
    mkdirSync('.agents/commands', { recursive: true });
    writeFileSync('.agents/commands/test.md', '# Test');

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'commands',
      file: '.agents/commands',
      targets: [
        'claude',
        { name: 'codex', to: './custom-commands' }
      ]
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.claude/commands/test.md')).toBe(true);
    expect(existsSync('custom-commands/test.md')).toBe(true);
  });

  it('should sync skills directory', () => {
    mkdirSync('.agents/skills', { recursive: true });
    writeFileSync('.agents/skills/coding.md', '# Coding Skill');

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'skills',
      file: '.agents/skills',
      targets: ['claude', 'cursor']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.claude/skills/coding.md')).toBe(true);
    expect(existsSync('.cursor/skills/coding.md')).toBe(true);
  });

  it('should sync agents directory', () => {
    mkdirSync('.agents/agents', { recursive: true });
    writeFileSync('.agents/agents/reviewer.md', '# Code Reviewer Agent');

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'agents',
      file: '.agents/agents',
      targets: ['claude']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.claude/agents/reviewer.md')).toBe(true);
  });

  it('should handle empty directories gracefully', () => {
    mkdirSync('.agents/commands', { recursive: true });
    // No files in the directory

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'commands',
      file: '.agents/commands',
      targets: ['claude']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    const result = execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(result).toContain('✅ Sync completed!');
  });

  it('should apply replaceEnv hook to all markdown files in directory', () => {
    mkdirSync('.agents/commands', { recursive: true });
    writeFileSync('.agents/commands/deploy.md', '# Deploy\nUser: __ENV_USER__');
    writeFileSync('.agents/commands/build.md', '# Build\nHome: __ENV_HOME__');

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'commands',
      file: '.agents/commands',
      targets: ['claude'],
      hooks: ['replaceEnv']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    const deployContent = readFileSync('.claude/commands/deploy.md', 'utf-8');
    const buildContent = readFileSync('.claude/commands/build.md', 'utf-8');

    // ENV variables should be replaced
    expect(deployContent).not.toContain('__ENV_USER__');
    expect(buildContent).not.toContain('__ENV_HOME__');
    expect(deployContent).toContain('User:');
    expect(buildContent).toContain('Home:');
  });

  it('should apply replaceStructure hook to all markdown files in directory', () => {
    // Create a project structure
    mkdirSync('src', { recursive: true });
    writeFileSync('src/index.ts', 'export {}');

    mkdirSync('.agents/commands', { recursive: true });
    writeFileSync('.agents/commands/info.md', '# Project Info\n\n__STRUCTURE__');
    writeFileSync('.agents/commands/overview.md', '# Overview\n\nStructure:\n__STRUCTURE__');

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'commands',
      file: '.agents/commands',
      targets: ['claude'],
      hooks: ['replaceStructure']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    const infoContent = readFileSync('.claude/commands/info.md', 'utf-8');
    const overviewContent = readFileSync('.claude/commands/overview.md', 'utf-8');

    // Structure placeholder should be replaced with actual structure
    expect(infoContent).not.toContain('__STRUCTURE__');
    expect(overviewContent).not.toContain('__STRUCTURE__');
    expect(infoContent).toContain('src');
    expect(overviewContent).toContain('src');
  });

  it('should apply multiple hooks to all markdown files in directory', () => {
    mkdirSync('.agents/commands', { recursive: true });
    writeFileSync('.agents/commands/full.md', '# Full Test\nTimestamp: __TIMESTAMP__\nUser: __ENV_USER__');

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'commands',
      file: '.agents/commands',
      targets: ['claude'],
      hooks: ['addTimestamp', 'replaceEnv']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    const content = readFileSync('.claude/commands/full.md', 'utf-8');

    // Both hooks should have been applied
    expect(content).not.toContain('__TIMESTAMP__');
    expect(content).not.toContain('__ENV_USER__');
    expect(content).toMatch(/Timestamp: \w+ \d{1,2}, \d{4}/);
  });

  it('should apply hooks to nested directory markdown files', () => {
    mkdirSync('.agents/commands/dev', { recursive: true });
    mkdirSync('.agents/commands/prod', { recursive: true });
    writeFileSync('.agents/commands/dev/start.md', '# Dev Start\nTime: __TIMESTAMP__');
    writeFileSync('.agents/commands/prod/deploy.md', '# Prod Deploy\nTime: __TIMESTAMP__');

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'commands',
      file: '.agents/commands',
      targets: ['claude'],
      hooks: ['addTimestamp']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    const devContent = readFileSync('.claude/commands/dev/start.md', 'utf-8');
    const prodContent = readFileSync('.claude/commands/prod/deploy.md', 'utf-8');

    // Hooks should be applied to nested files
    expect(devContent).not.toContain('__TIMESTAMP__');
    expect(prodContent).not.toContain('__TIMESTAMP__');
    expect(devContent).toMatch(/Time: \w+ \d{1,2}, \d{4}/);
    expect(prodContent).toMatch(/Time: \w+ \d{1,2}, \d{4}/);
  });

  it('should apply hooks to all agents directory files', () => {
    mkdirSync('.agents/agents', { recursive: true });
    writeFileSync('.agents/agents/reviewer.md', '# Reviewer\nCreated: __TIMESTAMP__');
    writeFileSync('.agents/agents/tester.md', '# Tester\nCreated: __TIMESTAMP__');

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'agents',
      file: '.agents/agents',
      targets: ['claude', 'cursor'],
      hooks: ['addTimestamp']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    // Check Claude agents
    const claudeReviewer = readFileSync('.claude/agents/reviewer.md', 'utf-8');
    const claudeTester = readFileSync('.claude/agents/tester.md', 'utf-8');
    expect(claudeReviewer).not.toContain('__TIMESTAMP__');
    expect(claudeTester).not.toContain('__TIMESTAMP__');

    // Check Cursor agents
    const cursorReviewer = readFileSync('.cursor/agents/reviewer.md', 'utf-8');
    const cursorTester = readFileSync('.cursor/agents/tester.md', 'utf-8');
    expect(cursorReviewer).not.toContain('__TIMESTAMP__');
    expect(cursorTester).not.toContain('__TIMESTAMP__');
  });

  it('should apply hooks to skills directory files', () => {
    mkdirSync('.agents/skills', { recursive: true });
    writeFileSync('.agents/skills/coding.md', '# Coding Skill\nVersion: __TIMESTAMP__');

    const config = `
export default {
  configDir: '.agents',
  rules: [
    {
      name: 'skills',
      file: '.agents/skills',
      targets: ['claude'],
      hooks: ['addTimestamp']
    }
  ]
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    const content = readFileSync('.claude/skills/coding.md', 'utf-8');
    expect(content).not.toContain('__TIMESTAMP__');
    expect(content).toMatch(/Version: \w+ \d{1,2}, \d{4}/);
  });

  // Tests for new top-level directory sync config
  it('should sync using top-level commands config (string)', () => {
    mkdirSync('.agents/commands', { recursive: true });
    writeFileSync('.agents/commands/build.md', '# Build Command');

    const config = `
export default {
  configDir: '.agents',
  rules: [],
  commands: '.agents/commands'
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.claude/commands/build.md')).toBe(true);
    expect(existsSync('.cursor/commands/build.md')).toBe(true);
  });

  it('should sync using top-level commands config (object with targets)', () => {
    mkdirSync('.agents/commands', { recursive: true });
    writeFileSync('.agents/commands/deploy.md', '# Deploy');

    const config = `
export default {
  configDir: '.agents',
  rules: [],
  commands: {
    path: '.agents/commands',
    targets: ['claude']
  }
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.claude/commands/deploy.md')).toBe(true);
    expect(existsSync('.cursor/commands/deploy.md')).toBe(false); // Not in targets
  });

  it('should sync multiple top-level directories', () => {
    mkdirSync('.agents/commands', { recursive: true });
    mkdirSync('.agents/skills', { recursive: true });
    mkdirSync('.agents/agents', { recursive: true });
    writeFileSync('.agents/commands/cmd.md', '# Command');
    writeFileSync('.agents/skills/skill.md', '# Skill');
    writeFileSync('.agents/agents/agent.md', '# Agent');

    const config = `
export default {
  configDir: '.agents',
  rules: [],
  commands: '.agents/commands',
  skills: { path: '.agents/skills', targets: ['claude'] },
  agents: { path: '.agents/agents', targets: ['cursor'] }
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    // Commands: both claude and cursor (default)
    expect(existsSync('.claude/commands/cmd.md')).toBe(true);
    expect(existsSync('.cursor/commands/cmd.md')).toBe(true);

    // Skills: claude only
    expect(existsSync('.claude/skills/skill.md')).toBe(true);
    expect(existsSync('.cursor/skills/skill.md')).toBe(false);

    // Agents: cursor only
    expect(existsSync('.claude/agents/agent.md')).toBe(false);
    expect(existsSync('.cursor/agents/agent.md')).toBe(true);
  });

  it('should preserve agent frontmatter when syncing to Cursor (no Cursor rules frontmatter added)', () => {
    mkdirSync('.agents/agents', { recursive: true });
    // Agent file with its own frontmatter (name, description, tools, model)
    writeFileSync('.agents/agents/api-contract-sync.md', `---
name: api-contract-sync
description: Align frontend API services with backend endpoints and error codes.
tools: Read, Grep, Glob, Bash
model: sonnet
---

# API Contract Sync Agent

This agent helps synchronize frontend API services with backend endpoints.`);

    const config = `
export default {
  configDir: '.agents',
  rules: [],
  agents: { path: '.agents/agents', targets: ['cursor'] }
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.cursor/agents/api-contract-sync.md')).toBe(true);

    const content = readFileSync('.cursor/agents/api-contract-sync.md', 'utf-8');

    // Should have exactly one YAML frontmatter block (the original agent frontmatter)
    const frontmatterDelimiters = content.match(/^---\r?\n/gm) || [];
    expect(frontmatterDelimiters.length).toBe(2); // Opening and closing of single frontmatter block

    // Should have the agent's original frontmatter (NOT Cursor's rules frontmatter)
    expect(content).toContain('name: api-contract-sync');
    expect(content).toContain('tools: Read, Grep, Glob, Bash');
    expect(content).toContain('model: sonnet');

    // Should NOT have Cursor's rules frontmatter
    expect(content).not.toContain('globs:');
    expect(content).not.toContain('alwaysApply:');

    // Should have the actual content
    expect(content).toContain('# API Contract Sync Agent');
    expect(content).toContain('This agent helps synchronize frontend API services');
  });

  it('should preserve skill frontmatter when syncing to Cursor (no Cursor rules frontmatter added)', () => {
    mkdirSync('.agents/skills', { recursive: true });
    // Skill file with its own frontmatter
    writeFileSync('.agents/skills/code-review.md', `---
name: code-review
description: Review code for best practices and potential issues.
tools: Read, Grep
---

# Code Review Skill

This skill performs code review analysis.`);

    const config = `
export default {
  configDir: '.agents',
  rules: [],
  skills: { path: '.agents/skills', targets: ['cursor'] }
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.cursor/skills/code-review.md')).toBe(true);

    const content = readFileSync('.cursor/skills/code-review.md', 'utf-8');

    // Should have exactly one YAML frontmatter block (the original skill frontmatter)
    const frontmatterDelimiters = content.match(/^---\r?\n/gm) || [];
    expect(frontmatterDelimiters.length).toBe(2); // Opening and closing of single frontmatter block

    // Should have the skill's original frontmatter
    expect(content).toContain('name: code-review');
    expect(content).toContain('tools: Read, Grep');

    // Should NOT have Cursor's rules frontmatter
    expect(content).not.toContain('globs:');
    expect(content).not.toContain('alwaysApply:');

    // Should have the actual content
    expect(content).toContain('# Code Review Skill');
    expect(content).toContain('This skill performs code review analysis.');
  });

  it('should handle agents without frontmatter syncing to Cursor', () => {
    mkdirSync('.agents/agents', { recursive: true });
    // Agent file without frontmatter
    writeFileSync('.agents/agents/simple-agent.md', `# Simple Agent

This is a simple agent without frontmatter.`);

    const config = `
export default {
  configDir: '.agents',
  rules: [],
  agents: { path: '.agents/agents', targets: ['cursor'] }
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.cursor/agents/simple-agent.md')).toBe(true);

    const content = readFileSync('.cursor/agents/simple-agent.md', 'utf-8');

    // Should NOT have any frontmatter added (agents don't get Cursor rules frontmatter)
    expect(content).not.toContain('globs:');
    expect(content).not.toContain('alwaysApply:');

    // Should have the actual content as-is
    expect(content).toContain('# Simple Agent');
    expect(content).toContain('This is a simple agent without frontmatter.');
  });

  it('should preserve agent frontmatter for Claude', () => {
    mkdirSync('.agents/agents', { recursive: true });
    // Agent file with its own frontmatter
    writeFileSync('.agents/agents/reviewer.md', `---
name: reviewer
description: Code reviewer agent.
tools: Read, Grep
model: opus
---

# Code Reviewer

Reviews code for quality.`);

    const config = `
export default {
  configDir: '.agents',
  rules: [],
  agents: { path: '.agents/agents', targets: ['claude'] }
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.claude/agents/reviewer.md')).toBe(true);

    const content = readFileSync('.claude/agents/reviewer.md', 'utf-8');

    // Should preserve the original agent frontmatter
    expect(content).toContain('name: reviewer');
    expect(content).toContain('description: Code reviewer agent.');
    expect(content).toContain('tools: Read, Grep');
    expect(content).toContain('model: opus');

    // Should have the actual content
    expect(content).toContain('# Code Reviewer');
    expect(content).toContain('Reviews code for quality.');
  });
});
