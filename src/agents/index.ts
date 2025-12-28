import type { AgentName, AgentMapping } from '../types';
import { homedir } from 'os';

// Known directory types that can be synced without explicit 'to' path
export const KNOWN_DIRECTORY_TYPES = ['commands', 'skills', 'agents'] as const;
export type KnownDirectoryType = typeof KNOWN_DIRECTORY_TYPES[number];

// Directory mappings for each agent - null means not supported
export const AGENT_DIRECTORY_MAPPINGS: Record<KnownDirectoryType, Partial<Record<AgentName, string>>> = {
  commands: {
    claude: '.claude/commands',
    cursor: '.cursor/commands',
    opencode: '.opencode/command',
  },
  skills: {
    claude: '.claude/skills',
    cursor: '.cursor/skills',
    opencode: '.claude/skills', // opencode uses Claude-compatible path
  },
  agents: {
    claude: '.claude/agents',
    cursor: '.cursor/agents',
    opencode: '.opencode/agent',
  },
};

export function getAgentDirectoryPath(agent: AgentName, dirType: string): string | null {
  if (!KNOWN_DIRECTORY_TYPES.includes(dirType as KnownDirectoryType)) {
    return null;
  }
  return AGENT_DIRECTORY_MAPPINGS[dirType as KnownDirectoryType][agent] ?? null;
}

export function isKnownDirectoryType(name: string): name is KnownDirectoryType {
  return KNOWN_DIRECTORY_TYPES.includes(name as KnownDirectoryType);
}

export const AGENT_MAPPINGS: Record<AgentName, AgentMapping> = {
  claude: {
    path: 'CLAUDE.md',
    format: 'markdown',
    mcpPath: '.mcp.json'
  },
  cursor: {
    path: '.cursor/rules/{name}.mdc',
    format: 'frontmatter',
    directory: '.cursor/rules',
    mcpPath: '~/.cursor/mcp.json'
  },
  codex: {
    path: 'AGENTS.md',
    format: 'markdown',
    mcpPath: 'codex_mcp.json'
  },
  roocode: {
    path: '.roo/rules/{name}.md',
    format: 'markdown',
    directory: '.roo/rules',
    mcpPath: '.roo/mcp.json'
  },
  opencode: {
    path: 'AGENTS.md',
    format: 'markdown',
    mcpPath: 'opencode.jsonc'
  },
  generic: {
    path: '{name}.md',
    format: 'markdown',
    mcpPath: 'mcp.json'
  }
};

export function getAgentPath(agent: AgentName, name = 'global'): string {
  const mapping = AGENT_MAPPINGS[agent];
  return mapping.path.replace('{name}', name);
}

export function getAgentDirectory(agent: AgentName): string | undefined {
  return AGENT_MAPPINGS[agent].directory;
}

export function getAgentMcpPath(agent: AgentName): string {
  const mcpPath = AGENT_MAPPINGS[agent].mcpPath;

  // Handle home directory expansion and test environment
  if (mcpPath.startsWith('~/')) {
    const isTest = process.env.NODE_ENV === 'test' || process.cwd().includes('test-') || process.cwd().includes('debug-');
    if (isTest) {
      // In test environment, use project-relative paths
      return mcpPath.replace('~/', './');
    } else {
      // In production, expand to actual home directory
      return mcpPath.replace('~/', `${homedir()}/`);
    }
  }

  return mcpPath;
}