import type { Agent, AgentMapping } from '../types';

export const AGENT_MAPPINGS: Record<Agent, AgentMapping> = {
  claude: {
    path: 'CLAUDE.md',
    format: 'markdown'
  },
  cursor: {
    path: '.cursor/rules/{name}.md',
    format: 'frontmatter',
    directory: '.cursor/rules'
  },
  codex: {
    path: 'AGENTS.md',
    format: 'markdown'
  },
  roocode: {
    path: '.roo/rules/{name}.md',
    format: 'markdown',
    directory: '.roo/rules'
  }
};

export function getAgentPath(agent: Agent, name: string = 'global'): string {
  const mapping = AGENT_MAPPINGS[agent];
  return mapping.path.replace('{name}', name);
}

export function getAgentDirectory(agent: Agent): string | undefined {
  return AGENT_MAPPINGS[agent].directory;
}