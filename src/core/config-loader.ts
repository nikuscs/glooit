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

  private static validateAndApplyDefaults(config: any): asserts config is Config {
    // Basic structure validation
    if (!config || typeof config !== 'object') {
      throw new Error('Config must be an object');
    }
    if (!Array.isArray(config.rules)) {
      throw new Error('Config.rules must be an array');
    }

    // Validate each rule
    config.rules.forEach((rule: any, index: number) => {
      this.validateRule(rule, index);
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

  private static validateRule(rule: any, index: number): void {
    if (!rule || typeof rule !== 'object') {
      throw new Error(`Rule at index ${index}: Rule must be an object`);
    }
    if (typeof rule.file !== 'string') {
      throw new Error(`Rule at index ${index}: Rule.file must be a string`);
    }
    if (typeof rule.to !== 'string') {
      throw new Error(`Rule at index ${index}: Rule.to must be a string`);
    }
    if (!Array.isArray(rule.targets) || rule.targets.length === 0) {
      throw new Error(`Rule at index ${index}: Rule.targets must be a non-empty array`);
    }

    const validAgents = ['claude', 'cursor', 'codex', 'roocode'];
    if (!rule.targets.every((agent: any) => validAgents.includes(agent))) {
      throw new Error(`Rule at index ${index}: Rule.targets must contain valid agents: ${validAgents.join(', ')}`);
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
    //   targets: ['claude'],
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
    //   targets: ['claude'],
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