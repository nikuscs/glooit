import { z } from 'zod';

export const AgentSchema = z.enum(['claude', 'cursor', 'codex', 'roocode']);
export type Agent = z.infer<typeof AgentSchema>;

export const HookFunctionSchema = z.function()
  .args(z.any())
  .returns(z.union([z.void(), z.promise(z.void()), z.string(), z.promise(z.string())]));

export const RuleSchema = z.object({
  file: z.string(),
  to: z.string(),
  globs: z.string().optional(),
  agents: z.array(AgentSchema).optional(),
  hooks: z.array(z.string()).optional(),
});

export const CommandSchema = z.object({
  command: z.string(),
  file: z.string(),
  agents: z.array(AgentSchema).optional(),
});

export const McpConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
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
  beforeSync: z.array(HookFunctionSchema).optional(),
  afterRule: z.array(HookFunctionSchema).optional(),
  onError: z.array(HookFunctionSchema).optional(),
});

export const ConfigSchema = z.object({
  configDir: z.string().default('.ai-rules'),
  agents: z.array(AgentSchema).default(['claude', 'cursor', 'codex', 'roocode']),
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