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
  command: z.string().optional(), // Optional for remote MCPs
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  type: z.string().optional(),
  url: z.string().optional(), // For remote MCPs
  headers: z.record(z.string(), z.string()).optional(), // For remote MCPs
  alwaysAllow: z.array(z.string()).optional(), // For roocode/cline
  disabled: z.boolean().optional(),
});

export const McpSchema = z.object({
  name: z.string(),
  config: McpConfigSchema,
  targets: z.array(AgentSchema).default(['claude']), // Which agents this MCP is for
  outputPath: z.string().optional(), // Will be determined by agent type if not specified
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
  configDir: z.string().default('.gloo'),
  rules: z.array(RuleSchema),
  commands: z.array(CommandSchema).optional(),
  mcps: z.array(McpSchema).optional(),
  mergeMcps: z.boolean().default(true), // Whether to merge MCPs with existing configs
  hooks: HooksSchema.optional(),
  backup: BackupConfigSchema.optional(),
});

export type Rule = z.infer<typeof RuleSchema>;
export type Command = z.infer<typeof CommandSchema>;
export type McpConfig = z.infer<typeof McpConfigSchema>;
export type Mcp = z.infer<typeof McpSchema>;

export interface ResolvedMcp extends Omit<Mcp, 'outputPath'> {
  outputPath: string; // Always defined after resolution
}
export type BackupConfig = z.infer<typeof BackupConfigSchema>;
export type Hooks = z.infer<typeof HooksSchema>;
export type Config = z.infer<typeof ConfigSchema>;

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
  files: Array<{
    path: string;
    content: string;
  }>;
}

export function defineRules(config: Config): Config {
  return ConfigSchema.parse(config);
}