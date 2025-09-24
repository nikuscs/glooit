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
      const fullPath = join(process.cwd(), configPath);
      let configModule;
      
      if (configPath.endsWith('.ts')) {
        try {
          const { createJiti } = await import('jiti');
          const jiti = createJiti(import.meta.url);
          configModule = await jiti.import(fullPath) as unknown;
        } catch (jitiError) {
          throw new Error(
            `Failed to load TypeScript config. Please either:\n` +
            `1. Use 'bunx glooit' instead of 'npx glooit'\n` +
            `2. Rename ${configPath} to ${configPath.replace('.ts', '.js')}\n` +
            `3. Use JavaScript config: npx glooit init --js\n` +
            `Original error: ${jitiError}`
          );
        }
      } else {
        configModule = await import(fullPath);
      }

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

export default defineRules({
  configDir: '.glooit',
  rules: [
    {
      name: 'main',
      file: '.glooit/main.md',
      to: './',
      targets: ['claude', 'cursor']
    }
  ],
});
`;
  }

  static createPlainConfig(): string {
    return `export default {
  configDir: '.glooit',
  rules: [
    {
      name: 'main',
      file: '.glooit/main.md',
      to: './',
      targets: ['claude', 'cursor']
    }
  ],
};
`;
  }
}