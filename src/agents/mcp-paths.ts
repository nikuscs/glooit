import { homedir } from 'os';
import { join } from 'path';
import type { Agent } from '../types';

export function getDefaultMcpPath(agent: Agent): string {
  // In production, these would be home directory paths
  // For development/testing, use relative paths
  const home = homedir();
  const isTest = process.env.NODE_ENV === 'test' || process.cwd().includes('test-') || process.cwd().includes('debug-');

  if (isTest) {
    switch (agent) {
      case 'claude':
        return 'claude_desktop_config.json';
      case 'cursor':
        return '.cursor/mcp.json';
      case 'roocode':
        return '.roo/mcp.json';
      case 'codex':
        return 'codex_mcp.json';
      default:
        return 'claude_desktop_config.json';
    }
  }

  switch (agent) {
    case 'claude':
      return join(home, 'Library/Application Support/Claude/claude_desktop_config.json');
    case 'cursor':
      return join(home, '.cursor/mcp.json');
    case 'roocode':
      return '.roo/mcp.json'; // Relative to project
    case 'codex':
      return 'codex_mcp.json'; // Relative to project
    default:
      return 'claude_desktop_config.json';
  }
}

export function getMcpPath(agent: Agent, customPath?: string): string {
  return customPath || getDefaultMcpPath(agent);
}

// For backward compatibility with non-typed calls
export function getMcpPathTyped(agent: string, customPath?: string): string {
  return customPath || getDefaultMcpPath(agent as Agent);
}