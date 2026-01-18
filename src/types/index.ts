import { resolveConfigDir } from '../core/utils';

export type AgentName = 'claude' | 'cursor' | 'codex' | 'roocode' | 'opencode' | 'generic';

export interface AgentTarget {
  name: AgentName;
  to?: string;
}

export type Agent = AgentName | AgentTarget;

// Base rule interface with common properties
interface BaseRule {
  name?: string;
  mode?: 'copy' | 'symlink';
  to: string;
  globs?: string;
  hooks?: string[];
  gitignore?: boolean;
}

// Single file rule - can use string or object targets
export interface SingleFileRule extends BaseRule {
  file: string;
  targets: Agent[];
}

// Merged file rule - must use object targets only
export interface MergedFileRule extends BaseRule {
  file: string[];
  targets: AgentTarget[];
}

// Union type for both rule types
export type Rule = SingleFileRule | MergedFileRule;

// Directory sync config for commands, skills, agents
export interface DirectorySyncConfig {
  /** Source directory path */
  path: string;
  /** Target agents (default: ['claude', 'cursor']) */
  targets?: AgentName[];
}

// Can be a simple string path or full config object
export type DirectorySync = string | DirectorySyncConfig;

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
  targets?: AgentName[];
  outputPath?: string;
}

export interface ResolvedMcp extends Omit<Mcp, 'outputPath'> {
  outputPath: string;
}

export interface BackupConfig {
  enabled?: boolean;
  retention?: number;
}

// Content transforms - modify rule content during sync
export interface Transforms {
  before?: ((context: { config: Config }) => Promise<void> | void)[];
  after?: ((context: SyncContext) => Promise<string | void> | string | void)[];
  error?: ((error: unknown) => Promise<void> | void)[];
}

// Agent lifecycle hooks (Claude Code, Cursor)
export type AgentHookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Stop'
  | 'UserPromptSubmit'
  // Cursor-specific events
  | 'beforeShellExecution'
  | 'afterShellExecution'
  | 'beforeFileEdit'
  | 'afterFileEdit'
  | 'beforeReadFile';

export interface AgentHook {
  /** Unique name for this hook */
  name?: string;
  /** The lifecycle event to hook into */
  event: AgentHookEvent;
  /** Shell command to run */
  command?: string;
  /** Path to a script file (TS/JS/sh) - will be run with bun for TS/JS */
  script?: string;
  /** Tool matcher for Claude Code (e.g., 'Edit|Write', 'Bash') */
  matcher?: string;
  /** File pattern filter (e.g., '*.ts') */
  filePattern?: string;
  /** Which agents to configure this hook for */
  targets: AgentName[];
}

export interface Config {
  configDir?: string;
  mode?: 'copy' | 'symlink';
  targets?: Agent[];
  rules: Rule[];
  /** Sync commands directory (e.g., '.agents/commands') */
  commands?: DirectorySync;
  /** Sync skills directory (e.g., '.agents/skills') */
  skills?: DirectorySync;
  /** Sync agents directory (e.g., '.agents/agents') */
  agents?: DirectorySync;
  mcps?: Mcp[];
  mergeMcps?: boolean;
  /** Content transforms - run during sync to modify rule content */
  transforms?: Transforms;
  /** Agent lifecycle hooks - configure Claude Code/Cursor hooks */
  hooks?: AgentHook[];
  backup?: BackupConfig;
  gitignore?: boolean;
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
  agent: AgentName;
}

export interface BackupEntry {
  timestamp: string;
  files: {
    path: string;
    content: string;
  }[];
}

// Simple validation functions
function isValidAgentName(agentName: unknown): agentName is AgentName {
  return ['claude', 'cursor', 'codex', 'roocode', 'opencode', 'generic'].includes(agentName as string);
}

function isValidAgent(agent: unknown): agent is Agent {
  if (typeof agent === 'string') {
    return isValidAgentName(agent);
  }
  if (typeof agent === 'object' && agent !== null) {
    const a = agent as Record<string, unknown>;
    return isValidAgentName(a.name) && (a.to === undefined || typeof a.to === 'string');
  }
  return false;
}

function validateRule(rule: unknown): asserts rule is Rule {
  if (!rule || typeof rule !== 'object') {
    throw new Error('Rule must be an object');
  }
  const r = rule as Record<string, unknown>;

  // Validate file - can be string or string array
  const isFileString = typeof r.file === 'string';
  const isFileArray = Array.isArray(r.file) && r.file.length > 0 && r.file.every((f: unknown) => typeof f === 'string');

  if (!isFileString && !isFileArray) {
    throw new Error('Rule.file must be a string or a non-empty array of strings');
  }

  if (typeof r.to !== 'string') {
    throw new Error('Rule.to must be a string');
  }
  if (r.mode !== undefined && r.mode !== 'copy' && r.mode !== 'symlink') {
    throw new Error('Rule.mode must be "copy" or "symlink"');
  }
  if (!Array.isArray(r.targets) || r.targets.length === 0) {
    throw new Error('Rule.targets must be a non-empty array');
  }
  if (!r.targets.every(isValidAgent)) {
    throw new Error('Rule.targets must contain valid agents: claude, cursor, codex, roocode, opencode, generic, or objects with {name, to?}');
  }

  // When file is an array (merge mode), all targets must be objects with 'to' property
  if (isFileArray) {
    const allTargetsAreObjects = r.targets.every((target: unknown) => {
      return typeof target === 'object' && target !== null &&
             'name' in target && 'to' in target;
    });
    if (!allTargetsAreObjects) {
      throw new Error('When using file array (merge mode), all targets must be objects with {name, to} properties');
    }
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
  if (c.mode !== undefined && c.mode !== 'copy' && c.mode !== 'symlink') {
    throw new Error('Config.mode must be "copy" or "symlink"');
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
  c.configDir = resolveConfigDir(c.configDir as string | undefined);
  c.mergeMcps = c.mergeMcps ?? true;
  c.gitignore = c.gitignore ?? true;
  c.mode = c.mode ?? 'copy';

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
