// TypeScript types and enums
export type Agent = 'claude' | 'cursor' | 'codex' | 'roocode';

export interface Rule {
  name?: string;
  file: string;
  to: string;
  globs?: string;
  targets: Agent[];
  hooks?: string[];
}

export interface Command {
  command: string;
  file: string;
  targets: Agent[];
}

export interface McpConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: string;
  url?: string;
  headers?: Record<string, string>;
  alwaysAllow?: string[];
  disabled?: boolean;
}

export interface Mcp {
  name: string;
  config: McpConfig;
  targets?: Agent[];
  outputPath?: string;
}

export interface ResolvedMcp extends Omit<Mcp, 'outputPath'> {
  outputPath: string;
}

export interface BackupConfig {
  enabled?: boolean;
  retention?: number;
}

export interface Hooks {
  before?: any[];
  after?: any[];
  error?: any[];
}

export interface Config {
  configDir?: string;
  targets?: Agent[];
  rules: Rule[];
  commands?: Command[];
  mcps?: Mcp[];
  mergeMcps?: boolean;
  hooks?: Hooks;
  backup?: BackupConfig;
}

export interface AgentMapping {
  path: string;
  format: 'markdown' | 'frontmatter';
  directory?: string;
  mcpPath: string;
}

export interface SyncContext {
  config: Config;
  rule: Rule;
  content: string;
  targetPath: string;
  agent: Agent;
}

export interface BackupEntry {
  timestamp: string;
  files: {
    path: string;
    content: string;
  }[];
}

// Simple validation functions
function isValidAgent(agent: any): agent is Agent {
  return ['claude', 'cursor', 'codex', 'roocode'].includes(agent);
}

function validateRule(rule: any): asserts rule is Rule {
  if (!rule || typeof rule !== 'object') {
    throw new Error('Rule must be an object');
  }
  if (typeof rule.file !== 'string') {
    throw new Error('Rule.file must be a string');
  }
  if (typeof rule.to !== 'string') {
    throw new Error('Rule.to must be a string');
  }
  if (!Array.isArray(rule.targets) || rule.targets.length === 0) {
    throw new Error('Rule.targets must be a non-empty array');
  }
  if (!rule.targets.every(isValidAgent)) {
    throw new Error('Rule.targets must contain valid agents: claude, cursor, codex, roocode');
  }
}

function validateConfig(config: any): asserts config is Config {
  if (!config || typeof config !== 'object') {
    throw new Error('Config must be an object');
  }
  if (!Array.isArray(config.rules)) {
    throw new Error('Config.rules must be an array');
  }

  // Validate each rule
  config.rules.forEach((rule: any, index: number) => {
    try {
      validateRule(rule);
    } catch (error) {
      throw new Error(`Rule at index ${index}: ${error}`);
    }
  });

  // Apply defaults
  config.configDir = config.configDir || '.glooit';
  config.mergeMcps = config.mergeMcps ?? true;

  if (config.backup) {
    config.backup.enabled = config.backup.enabled ?? true;
    config.backup.retention = config.backup.retention ?? 10;
  }

  if (config.mcps) {
    config.mcps.forEach((mcp: any) => {
      if (!mcp.targets) {
        mcp.targets = ['claude'];
      }
    });
  }
}

export function defineRules(config: Config): Config {
  validateConfig(config);
  return config;
}