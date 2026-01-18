import { describe, it, expect } from 'vitest';
import { AGENT_MAPPINGS, getAgentPath, getAgentDirectory, getAgentDirectoryPath, getAgentMcpPath } from '../../src/agents';

describe('Agent Mappings', () => {
  describe('AGENT_MAPPINGS', () => {
    it('should have mappings for all supported agents', () => {
      expect(AGENT_MAPPINGS.claude).toBeDefined();
      expect(AGENT_MAPPINGS.cursor).toBeDefined();
      expect(AGENT_MAPPINGS.codex).toBeDefined();
      expect(AGENT_MAPPINGS.roocode).toBeDefined();
    });

    it('should have correct path patterns', () => {
      expect(AGENT_MAPPINGS.claude.path).toBe('CLAUDE.md');
      expect(AGENT_MAPPINGS.cursor.path).toBe('.cursor/rules/{name}.mdc');
      expect(AGENT_MAPPINGS.codex.path).toBe('AGENTS.md');
      expect(AGENT_MAPPINGS.roocode.path).toBe('.roo/rules/{name}.md');
    });

    it('should have correct formats', () => {
      expect(AGENT_MAPPINGS.claude.format).toBe('markdown');
      expect(AGENT_MAPPINGS.cursor.format).toBe('frontmatter');
      expect(AGENT_MAPPINGS.codex.format).toBe('markdown');
      expect(AGENT_MAPPINGS.roocode.format).toBe('markdown');
    });
  });

  describe('getAgentPath', () => {
    it('should replace {name} placeholder correctly', () => {
      expect(getAgentPath('cursor', 'main')).toBe('.cursor/rules/main.mdc');
      expect(getAgentPath('roocode', 'frontend')).toBe('.roo/rules/frontend.md');
    });

    it('should use static paths for agents without placeholders', () => {
      expect(getAgentPath('claude', 'any-name')).toBe('CLAUDE.md');
      expect(getAgentPath('codex', 'any-name')).toBe('AGENTS.md');
    });

    it('should use default name when not provided', () => {
      expect(getAgentPath('cursor')).toBe('.cursor/rules/global.mdc');
      expect(getAgentPath('roocode')).toBe('.roo/rules/global.md');
    });
  });

  describe('getAgentDirectory', () => {
    it('should return directories for agents that need them', () => {
      expect(getAgentDirectory('cursor')).toBe('.cursor/rules');
      expect(getAgentDirectory('roocode')).toBe('.roo/rules');
    });

    it('should return undefined for agents without directories', () => {
      expect(getAgentDirectory('claude')).toBeUndefined();
      expect(getAgentDirectory('opencode')).toBeUndefined();
    });

    it('should return directories for codex and factory', () => {
      expect(getAgentDirectory('codex')).toBe('.codex');
      expect(getAgentDirectory('factory')).toBe('.factory');
    });
  });

  describe('getAgentDirectoryPath', () => {
    it('should return mapped directory paths for known types', () => {
      expect(getAgentDirectoryPath('claude', 'commands')).toBe('.claude/commands');
      expect(getAgentDirectoryPath('cursor', 'skills')).toBe('.cursor/skills');
      expect(getAgentDirectoryPath('opencode', 'agents')).toBe('.opencode/agent');
    });

    it('should return null for unknown directory types', () => {
      expect(getAgentDirectoryPath('claude', 'unknown')).toBeNull();
    });
  });

  describe('getAgentMcpPath', () => {
    it('should return project-relative path for cursor in tests', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      expect(getAgentMcpPath('cursor')).toBe('./.cursor/mcp.json');
      process.env.NODE_ENV = originalEnv;
    });
  });
});
