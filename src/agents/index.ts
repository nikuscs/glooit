import type { Agent, AgentMapping } from '../types';
import { homedir } from 'os';

export const AGENT_MAPPINGS: Record<Agent, AgentMapping> = {
  claude: {
    path: 'CLAUDE.md',
    format: 'markdown',
    mcpPath: '.mcp.json'
  },
  cursor: {
    path: '.cursor/rules/{name}.md',
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
  }
};

export function getAgentPath(agent: Agent, name = 'global'): string {
  const mapping = AGENT_MAPPINGS[agent];
  return mapping.path.replace('{name}', name);
}

export function getAgentDirectory(agent: Agent): string | undefined {
  return AGENT_MAPPINGS[agent].directory;
}

export function getAgentMcpPath(agent: Agent): string {
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