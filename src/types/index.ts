import { z } from 'zod';

export const AgentSchema = z.enum(['claude', 'cursor', 'codex', 'roocode']);
export type Agent = z.infer<typeof AgentSchema>;

export const HookFunctionSchema = z.any();

export const RuleSchema = z.object({
  file: z.string(),
  to: z.string(),
  globs: z.string().optional(),
  targets: z.array(AgentSchema),
  hooks: z.array(z.string()).optional(),
});

export const CommandSchema = z.object({
  command: z.string(),
  file: z.string(),
  targets: z.array(AgentSchema),
});

export const McpConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  type: z.string().optional(),
});

export const McpSchema = z.object({
  name: z.string(),
  config: McpConfigSchema,
  outputPath: z.string().optional(),
});

export const BackupConfigSchema = z.object({
  enabled: z.boolean().default(true),
  retention: z.number().default(10),
});

export const HooksSchema = z.object({
  before: z.array(HookFunctionSchema).optional(),
  after: z.array(HookFunctionSchema).optional(),
  error: z.array(HookFunctionSchema).optional(),
});

export const ConfigSchema = z.object({
  configDir: z.string().default('.ai-rules'),
  rules: z.array(RuleSchema),
  commands: z.array(CommandSchema).optional(),
  mcps: z.array(McpSchema).optional(),
  hooks: HooksSchema.optional(),
  backup: BackupConfigSchema.optional(),
});

export type Rule = z.infer<typeof RuleSchema>;
export type Command = z.infer<typeof CommandSchema>;
export type McpConfig = z.infer<typeof McpConfigSchema>;
export type Mcp = z.infer<typeof McpSchema>;
export type BackupConfig = z.infer<typeof BackupConfigSchema>;
export type Hooks = z.infer<typeof HooksSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export interface AgentMapping {
  path: string;
  format: 'markdown' | 'frontmatter';
  directory?: string;
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
  files: Array<{
    path: string;
    content: string;
  }>;
}

export function defineRules(config: Config): Config {
  return ConfigSchema.parse(config);
}