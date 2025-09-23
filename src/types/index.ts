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
  before?: ((context: { config: Config }) => Promise<void> | void)[];
  after?: ((context: SyncContext) => Promise<string | void> | string | void)[];
  error?: ((error: unknown) => Promise<void> | void)[];
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
function isValidAgent(agent: unknown): agent is Agent {
  return ['claude', 'cursor', 'codex', 'roocode'].includes(agent as string);
}

function validateRule(rule: unknown): asserts rule is Rule {
  if (!rule || typeof rule !== 'object') {
    throw new Error('Rule must be an object');
  }
  const r = rule as Record<string, unknown>;
  if (typeof r.file !== 'string') {
    throw new Error('Rule.file must be a string');
  }
  if (typeof r.to !== 'string') {
    throw new Error('Rule.to must be a string');
  }
  if (!Array.isArray(r.targets) || r.targets.length === 0) {
    throw new Error('Rule.targets must be a non-empty array');
  }
  if (!r.targets.every(isValidAgent)) {
    throw new Error('Rule.targets must contain valid agents: claude, cursor, codex, roocode');
  }
}

function validateConfig(config: unknown): asserts config is Config {
  if (!config || typeof config !== 'object') {
    throw new Error('Config must be an object');
  }
  const c = config as Record<string, unknown>;
  if (!Array.isArray(c.rules)) {
    throw new Error('Config.rules must be an array');
  }

  // Validate each rule
  c.rules.forEach((rule: unknown, index: number) => {
    try {
      validateRule(rule);
    } catch (error) {
      throw new Error(`Rule at index ${index}: ${error}`);
    }
  });

  // Apply defaults
  c.configDir = c.configDir || '.glooit';
  c.mergeMcps = c.mergeMcps ?? true;

  if (c.backup) {
    const backup = c.backup as Record<string, unknown>;
    backup.enabled = backup.enabled ?? true;
    backup.retention = backup.retention ?? 10;
  }

  if (c.mcps) {
    (c.mcps as unknown[]).forEach((mcp: unknown) => {
      const m = mcp as Record<string, unknown>;
      if (!m.targets) {
        m.targets = ['claude'];
      }
    });
  }
}

export function defineRules(config: Config): Config {
  validateConfig(config);
  return config;
}