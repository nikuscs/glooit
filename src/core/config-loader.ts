import { existsSync } from 'fs';
import { join } from 'path';
import type { Config } from '../types';

export class ConfigLoader {
  private static readonly DEFAULT_CONFIG_PATHS = [
    'glooit.config.ts',
    'glooit.config.js',
    'config/glooit.ts',
    'config/glooit.js',
  ];

  static async load(customPath?: string): Promise<Config> {
    const configPath = customPath || this.findConfigFile();

    if (!configPath) {
      throw new Error(
        `No configuration file found. Looking for: ${this.DEFAULT_CONFIG_PATHS.join(', ')}`
      );
    }

    try {
      const configModule = await import(join(process.cwd(), configPath));
      const config = configModule.default || configModule;

      if (typeof config === 'function') {
        const result = config();
        this.validateAndApplyDefaults(result);
        return result;
      }

      this.validateAndApplyDefaults(config);
      return config;
    } catch (error) {
      throw new Error(`Failed to load config from ${configPath}: ${error}`);
    }
  }

  private static findConfigFile(): string | null {
    for (const path of this.DEFAULT_CONFIG_PATHS) {
      if (existsSync(path)) {
        return path;
      }
    }
    return null;
  }

  static async validate(customPath?: string): Promise<boolean> {
    try {
      await this.load(customPath);
      return true;
    } catch {
      return false;
    }
  }

  private static validateAndApplyDefaults(config: unknown): asserts config is Config {
    // Basic structure validation
    if (!config || typeof config !== 'object') {
      throw new Error('Config must be an object');
    }
    const c = config as Record<string, unknown>;
    if (!Array.isArray(c.rules)) {
      throw new Error('Config.rules must be an array');
    }

    // Validate each rule
    c.rules.forEach((rule: unknown, index: number) => {
      this.validateRule(rule, index);
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

  private static validateRule(rule: unknown, index: number): void {
    if (!rule || typeof rule !== 'object') {
      throw new Error(`Rule at index ${index}: Rule must be an object`);
    }
    const r = rule as Record<string, unknown>;
    if (typeof r.file !== 'string') {
      throw new Error(`Rule at index ${index}: Rule.file must be a string`);
    }
    if (typeof r.to !== 'string') {
      throw new Error(`Rule at index ${index}: Rule.to must be a string`);
    }
    if (!Array.isArray(r.targets) || r.targets.length === 0) {
      throw new Error(`Rule at index ${index}: Rule.targets must be a non-empty array`);
    }

    const validAgentNames = ['claude', 'cursor', 'codex', 'roocode', 'generic'];
    if (!r.targets.every((agent: unknown) => {
      if (typeof agent === 'string') {
        return validAgentNames.includes(agent);
      }
      if (typeof agent === 'object' && agent !== null) {
        const a = agent as Record<string, unknown>;
        return validAgentNames.includes(a.name as string) && (a.to === undefined || typeof a.to === 'string');
      }
      return false;
    })) {
      throw new Error(`Rule at index ${index}: Rule.targets must contain valid agents: ${validAgentNames.join(', ')}, or objects with {name, to?}`);
    }
  }

  static createInitialConfig(): string {
    return this.createTypedConfig();
  }

  static createTypedConfig(): string {
    return `import { defineRules } from 'glooit';

// defineRules() provides TypeScript IntelliSense and validation
export default defineRules({
  // Directory where glooit stores configuration files
  configDir: '.glooit',

  // Default targets for all rules (can be overridden per rule)
  targets: ['claude', 'cursor'],

  // Rules define how to sync your files to different AI agents
  rules: [
    {
      name: 'main',
      file: '.glooit/main.md',         // Source file to sync
      to: './',                        // Destination directory
      targets: ['claude', 'cursor']    // Which agents to sync to
    }
    // Add more rules here:
    // {
    //   name: 'coding-standards',
    //   file: '.glooit/coding-rules.md',
    //   to: './',
    //   targets: [
    //     'claude',
    //     { name: 'cursor', to: './custom/cursor-rules.mdc' }, // Custom path override
    //     { name: 'generic', to: './docs/coding-standards.md' } // Generic agent with custom path
    //   ],
    //   globs: '**/*.{ts,js,tsx,jsx}' // Optional: only apply to certain file patterns
    // }
  ],

  // MCP (Model Context Protocol) server configurations
  mcps: [
    // Example MCP server configurations:
    // {
    //   name: 'database',
    //   config: {
    //     command: 'npx',
    //     args: ['@modelcontextprotocol/server-postgres'],
    //     env: { DATABASE_URL: process.env.DATABASE_URL }
    //   },
    //   targets: ['claude']
    // },
    // {
    //   name: 'filesystem',
    //   config: {
    //     command: 'npx',
    //     args: ['@modelcontextprotocol/server-filesystem', process.cwd()]
    //   },
    //   targets: ['claude', 'cursor']
    // }
  ],

  // Additional options:
  // mergeMcps: true,        // Merge with existing MCP configs (default: true)
  // backup: {               // Backup settings
  //   enabled: true,         // Create backups before syncing (default: true)
  //   retention: 10          // Keep last 10 backups (default: 10)
  // },
  // hooks: {                // Custom hooks for advanced workflows
  //   before: [],           // Run before sync
  //   after: [],            // Run after sync
  //   error: []             // Run on error
  // }
});
`;
  }

  static createPlainConfig(): string {
    return `export default {
  // Directory where glooit stores configuration files
  configDir: '.glooit',

  // Default targets for all rules (can be overridden per rule)
  targets: ['claude', 'cursor'],

  // Rules define how to sync your files to different AI agents
  rules: [
    {
      name: 'main',
      file: '.glooit/main.md',         // Source file to sync
      to: './',                        // Destination directory
      targets: ['claude', 'cursor']    // Which agents to sync to
    }
    // Add more rules here:
    // {
    //   name: 'coding-standards',
    //   file: '.glooit/coding-rules.md',
    //   to: './',
    //   targets: [
    //     'claude',
    //     { name: 'cursor', to: './custom/cursor-rules.mdc' }, // Custom path override
    //     { name: 'generic', to: './docs/coding-standards.md' } // Generic agent with custom path
    //   ],
    //   globs: '**/*.{ts,js,tsx,jsx}' // Optional: only apply to certain file patterns
    // }
  ],

  // MCP (Model Context Protocol) server configurations
  mcps: [
    // Example MCP server configurations:
    // {
    //   name: 'database',
    //   config: {
    //     command: 'npx',
    //     args: ['@modelcontextprotocol/server-postgres'],
    //     env: { DATABASE_URL: process.env.DATABASE_URL }
    //   },
    //   targets: ['claude']
    // },
    // {
    //   name: 'filesystem',
    //   config: {
    //     command: 'npx',
    //     args: ['@modelcontextprotocol/server-filesystem', process.cwd()]
    //   },
    //   targets: ['claude', 'cursor']
    // }
  ]

  // Additional options:
  // mergeMcps: true,        // Merge with existing MCP configs (default: true)
  // backup: {               // Backup settings
  //   enabled: true,         // Create backups before syncing (default: true)
  //   retention: 10          // Keep last 10 backups (default: 10)
  // },
  // hooks: {                // Custom hooks for advanced workflows
  //   before: [],           // Run before sync
  //   after: [],            // Run after sync
  //   error: []             // Run on error
  // }
};
`;
  }
}