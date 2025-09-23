export { defineRules } from './types';
export type {
  Config,
  Rule,
  Command,
  Mcp,
  Agent,
  SyncContext
} from './types';

export { AIRulesCore } from './core';
export { ConfigLoader } from './core/config-loader';
export { AgentDistributor } from './agents/distributor';
export { BackupManager } from './core/backup';
export { GitIgnoreManager } from './core/gitignore';
export { HookManager } from './hooks';

// Built-in hooks for user import
export * as hooks from './hooks/builtin';