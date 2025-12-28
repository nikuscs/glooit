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
    mkdirSync('.glooit/commands', { recursive: true });
    writeFileSync('.glooit/commands/deploy.md', '# Deploy Command\nDeploy the application');
    writeFileSync('.glooit/commands/test.md', '# Test Command\nRun tests');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'commands',
      file: '.glooit/commands',
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
    mkdirSync('.glooit/commands', { recursive: true });
    writeFileSync('.glooit/commands/hello.md', '# Hello');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      file: '.glooit/commands',
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
    mkdirSync('.glooit/commands/dev', { recursive: true });
    mkdirSync('.glooit/commands/prod', { recursive: true });
    writeFileSync('.glooit/commands/dev/start.md', '# Dev Start');
    writeFileSync('.glooit/commands/prod/deploy.md', '# Prod Deploy');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'commands',
      file: '.glooit/commands',
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
    mkdirSync('.glooit/commands', { recursive: true });
    writeFileSync('.glooit/commands/info.md', '# Info\nTimestamp: __TIMESTAMP__');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'commands',
      file: '.glooit/commands',
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
    mkdirSync('.glooit/commands', { recursive: true });
    writeFileSync('.glooit/commands/script.sh', '#!/bin/bash\necho "hello"');
    writeFileSync('.glooit/commands/readme.txt', 'Some text file');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'commands',
      file: '.glooit/commands',
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
    mkdirSync('.glooit/commands', { recursive: true });
    writeFileSync('.glooit/commands/test.md', '# Test');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'commands',
      file: '.glooit/commands',
      targets: ['codex']
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
    mkdirSync('.glooit/commands', { recursive: true });
    writeFileSync('.glooit/commands/test.md', '# Test');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'commands',
      file: '.glooit/commands',
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
    mkdirSync('.glooit/skills', { recursive: true });
    writeFileSync('.glooit/skills/coding.md', '# Coding Skill');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'skills',
      file: '.glooit/skills',
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
    mkdirSync('.glooit/agents', { recursive: true });
    writeFileSync('.glooit/agents/reviewer.md', '# Code Reviewer Agent');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'agents',
      file: '.glooit/agents',
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
    mkdirSync('.glooit/commands', { recursive: true });
    // No files in the directory

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'commands',
      file: '.glooit/commands',
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
    mkdirSync('.glooit/commands', { recursive: true });
    writeFileSync('.glooit/commands/deploy.md', '# Deploy\nUser: __ENV_USER__');
    writeFileSync('.glooit/commands/build.md', '# Build\nHome: __ENV_HOME__');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'commands',
      file: '.glooit/commands',
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

    mkdirSync('.glooit/commands', { recursive: true });
    writeFileSync('.glooit/commands/info.md', '# Project Info\n\n__STRUCTURE__');
    writeFileSync('.glooit/commands/overview.md', '# Overview\n\nStructure:\n__STRUCTURE__');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'commands',
      file: '.glooit/commands',
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
    mkdirSync('.glooit/commands', { recursive: true });
    writeFileSync('.glooit/commands/full.md', '# Full Test\nTimestamp: __TIMESTAMP__\nUser: __ENV_USER__');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'commands',
      file: '.glooit/commands',
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
    mkdirSync('.glooit/commands/dev', { recursive: true });
    mkdirSync('.glooit/commands/prod', { recursive: true });
    writeFileSync('.glooit/commands/dev/start.md', '# Dev Start\nTime: __TIMESTAMP__');
    writeFileSync('.glooit/commands/prod/deploy.md', '# Prod Deploy\nTime: __TIMESTAMP__');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'commands',
      file: '.glooit/commands',
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
    mkdirSync('.glooit/agents', { recursive: true });
    writeFileSync('.glooit/agents/reviewer.md', '# Reviewer\nCreated: __TIMESTAMP__');
    writeFileSync('.glooit/agents/tester.md', '# Tester\nCreated: __TIMESTAMP__');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'agents',
      file: '.glooit/agents',
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
    mkdirSync('.glooit/skills', { recursive: true });
    writeFileSync('.glooit/skills/coding.md', '# Coding Skill\nVersion: __TIMESTAMP__');

    const config = `
export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'skills',
      file: '.glooit/skills',
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
    mkdirSync('.glooit/commands', { recursive: true });
    writeFileSync('.glooit/commands/build.md', '# Build Command');

    const config = `
export default {
  configDir: '.glooit',
  rules: [],
  commands: '.glooit/commands'
};
`;
    writeFileSync('glooit.config.ts', config);

    const cliPath = `${originalCwd}/src/cli/index.ts`;
    execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

    expect(existsSync('.claude/commands/build.md')).toBe(true);
    expect(existsSync('.cursor/commands/build.md')).toBe(true);
  });

  it('should sync using top-level commands config (object with targets)', () => {
    mkdirSync('.glooit/commands', { recursive: true });
    writeFileSync('.glooit/commands/deploy.md', '# Deploy');

    const config = `
export default {
  configDir: '.glooit',
  rules: [],
  commands: {
    path: '.glooit/commands',
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
    mkdirSync('.glooit/commands', { recursive: true });
    mkdirSync('.glooit/skills', { recursive: true });
    mkdirSync('.glooit/agents', { recursive: true });
    writeFileSync('.glooit/commands/cmd.md', '# Command');
    writeFileSync('.glooit/skills/skill.md', '# Skill');
    writeFileSync('.glooit/agents/agent.md', '# Agent');

    const config = `
export default {
  configDir: '.glooit',
  rules: [],
  commands: '.glooit/commands',
  skills: { path: '.glooit/skills', targets: ['claude'] },
  agents: { path: '.glooit/agents', targets: ['cursor'] }
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
});
