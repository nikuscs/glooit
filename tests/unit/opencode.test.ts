import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { AIRulesCore } from '../../src/core';
import type { Config } from '../../src/types';
import { getAgentPath, getAgentDirectoryPath, getAgentMcpPath } from '../../src/agents';

describe('OpenCode Support', () => {
  const testDir = 'test-opencode';

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    process.chdir(testDir);
    mkdirSync('.agents', { recursive: true });
  });

  afterEach(() => {
    process.chdir('..');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('Agent Mappings', () => {
    it('should return AGENTS.md as the default path for opencode', () => {
      expect(getAgentPath('opencode')).toBe('AGENTS.md');
    });

    it('should return opencode.jsonc as the MCP path', () => {
      expect(getAgentMcpPath('opencode')).toBe('opencode.jsonc');
    });

    it('should return correct directory paths for commands', () => {
      expect(getAgentDirectoryPath('opencode', 'commands')).toBe('.opencode/command');
    });

    it('should return correct directory paths for agents', () => {
      expect(getAgentDirectoryPath('opencode', 'agents')).toBe('.opencode/agent');
    });

    it('should return Claude-compatible path for skills', () => {
      // OpenCode uses Claude-compatible skills path
      expect(getAgentDirectoryPath('opencode', 'skills')).toBe('.claude/skills');
    });
  });

  describe('Rule Distribution', () => {
    it('should distribute rules to AGENTS.md', async () => {
      writeFileSync('.agents/test.md', '# Test Rule\n\nThis is a test.');

      const config: Config = {
        rules: [{
          file: '.agents/test.md',
          to: './',
          targets: ['opencode']
        }],
        mergeMcps: true
      };

      const core = new AIRulesCore(config);
      await core.sync();

      expect(existsSync('AGENTS.md')).toBe(true);
      const content = readFileSync('AGENTS.md', 'utf-8');
      expect(content).toContain('# Test Rule');
      expect(content).toContain('This is a test.');
    });

    it('should distribute to both opencode and codex (same AGENTS.md)', async () => {
      writeFileSync('.agents/test.md', '# Shared Rule');

      const config: Config = {
        rules: [{
          file: '.agents/test.md',
          to: './',
          targets: ['opencode', 'codex']
        }],
        mergeMcps: true
      };

      const core = new AIRulesCore(config);
      await core.sync();

      // Both use AGENTS.md - last write wins (same content)
      expect(existsSync('AGENTS.md')).toBe(true);
      const content = readFileSync('AGENTS.md', 'utf-8');
      expect(content).toContain('# Shared Rule');
    });

    it('should distribute to opencode and claude separately', async () => {
      writeFileSync('.agents/test.md', '# Multi-Agent Rule');

      const config: Config = {
        rules: [{
          file: '.agents/test.md',
          to: './',
          targets: ['opencode', 'claude']
        }],
        mergeMcps: true
      };

      const core = new AIRulesCore(config);
      await core.sync();

      expect(existsSync('AGENTS.md')).toBe(true);
      expect(existsSync('CLAUDE.md')).toBe(true);

      const agentsContent = readFileSync('AGENTS.md', 'utf-8');
      const claudeContent = readFileSync('CLAUDE.md', 'utf-8');

      expect(agentsContent).toContain('# Multi-Agent Rule');
      expect(claudeContent).toContain('# Multi-Agent Rule');
    });
  });

  describe('Directory Sync', () => {
    it('should sync commands to .opencode/command/', async () => {
      mkdirSync('.agents/commands', { recursive: true });
      writeFileSync('.agents/commands/test.md', '# Test Command');

      const config: Config = {
        rules: [],
        commands: {
          path: '.agents/commands',
          targets: ['opencode']
        },
        mergeMcps: true
      };

      const core = new AIRulesCore(config);
      await core.sync();

      expect(existsSync('.opencode/command/test.md')).toBe(true);
      const content = readFileSync('.opencode/command/test.md', 'utf-8');
      expect(content).toContain('# Test Command');
    });

    it('should sync agents to .opencode/agent/', async () => {
      mkdirSync('.agents/agents', { recursive: true });
      writeFileSync('.agents/agents/reviewer.md', '# Reviewer Agent');

      const config: Config = {
        rules: [],
        agents: {
          path: '.agents/agents',
          targets: ['opencode']
        },
        mergeMcps: true
      };

      const core = new AIRulesCore(config);
      await core.sync();

      expect(existsSync('.opencode/agent/reviewer.md')).toBe(true);
      const content = readFileSync('.opencode/agent/reviewer.md', 'utf-8');
      expect(content).toContain('# Reviewer Agent');
    });

    it('should sync skills to Claude-compatible path for opencode', async () => {
      mkdirSync('.agents/skills', { recursive: true });
      writeFileSync('.agents/skills/test.md', '# Test Skill');

      const config: Config = {
        rules: [],
        skills: {
          path: '.agents/skills',
          targets: ['opencode']
        },
        mergeMcps: true
      };

      const core = new AIRulesCore(config);
      await core.sync();

      // OpenCode uses Claude-compatible skills path
      expect(existsSync('.claude/skills/test.md')).toBe(true);
      const content = readFileSync('.claude/skills/test.md', 'utf-8');
      expect(content).toContain('# Test Skill');
    });
  });

  describe('Gitignore', () => {
    it('should add opencode files to gitignore', async () => {
      writeFileSync('.agents/test.md', '# Test');

      const config: Config = {
        rules: [{
          file: '.agents/test.md',
          to: './',
          targets: ['opencode']
        }],
        mergeMcps: true
      };

      const core = new AIRulesCore(config);
      await core.sync();

      expect(existsSync('.gitignore')).toBe(true);
      const gitignoreContent = readFileSync('.gitignore', 'utf-8');
      expect(gitignoreContent).toContain('AGENTS.md');
    });
  });

  describe('Default Directory Sync Targets', () => {
    it('should sync to claude, cursor, and opencode by default when using string path', async () => {
      mkdirSync('.agents/commands', { recursive: true });
      writeFileSync('.agents/commands/test.md', '# Test Command');

      const config: Config = {
        rules: [],
        commands: '.agents/commands', // Simple string path - should default to all supported agents
        mergeMcps: true
      };

      const core = new AIRulesCore(config);
      await core.sync();

      // Should sync to all three agents that support commands
      expect(existsSync('.claude/commands/test.md')).toBe(true);
      expect(existsSync('.cursor/commands/test.md')).toBe(true);
      expect(existsSync('.opencode/command/test.md')).toBe(true);
    });

    it('should sync skills to claude, cursor, and opencode (claude path) by default', async () => {
      mkdirSync('.agents/skills', { recursive: true });
      writeFileSync('.agents/skills/test.md', '# Test Skill');

      const config: Config = {
        rules: [],
        skills: '.agents/skills',
        mergeMcps: true
      };

      const core = new AIRulesCore(config);
      await core.sync();

      // Claude and Cursor get their own paths
      expect(existsSync('.claude/skills/test.md')).toBe(true);
      expect(existsSync('.cursor/skills/test.md')).toBe(true);
      // OpenCode uses Claude-compatible path (same file)
    });

    it('should sync agents to claude, cursor, and opencode by default', async () => {
      mkdirSync('.agents/agents', { recursive: true });
      writeFileSync('.agents/agents/test.md', '# Test Agent');

      const config: Config = {
        rules: [],
        agents: '.agents/agents',
        mergeMcps: true
      };

      const core = new AIRulesCore(config);
      await core.sync();

      expect(existsSync('.claude/agents/test.md')).toBe(true);
      expect(existsSync('.cursor/agents/test.md')).toBe(true);
      expect(existsSync('.opencode/agent/test.md')).toBe(true);
    });
  });
});
