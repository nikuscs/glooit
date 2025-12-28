export { defineRules } from './types';
export type {
  Config,
  Rule,
  Command,
  Mcp,
  Agent,
  AgentHook,
  AgentHookEvent,
  SyncContext,
  Transforms
} from './types';

export { AIRulesCore } from './core';
export { ConfigLoader } from './core/config-loader';
export { AgentDistributor } from './agents/distributor';
export { AgentHooksDistributor } from './agents/hooks-distributor';
export { BackupManager } from './core/backup';
export { GitIgnoreManager } from './core/gitignore';
export { HookManager } from './hooks';

// Built-in transforms for content modification during sync
export * as transforms from './hooks/builtin';