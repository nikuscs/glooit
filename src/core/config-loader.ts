import { existsSync, statSync } from 'fs';
import { join, basename } from 'path';
import type { Config } from '../types';
import { isKnownDirectoryType } from '../agents';
import { resolveConfigDir } from './utils';

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
      /* istanbul ignore next -- CLI-only missing-config guard */
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
    /* istanbul ignore next -- only reached when no config files exist */
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
    if (c.mode !== undefined && c.mode !== 'copy' && c.mode !== 'symlink') {
      throw new Error('Config.mode must be "copy" or "symlink"');
    }

    // Validate each rule
    c.rules.forEach((rule: unknown, index: number) => {
      this.validateRule(rule, index);
    });

    // Apply defaults
    c.configDir = resolveConfigDir(c.configDir);
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

  private static validateRule(rule: unknown, index: number): void {
    if (!rule || typeof rule !== 'object') {
      throw new Error(`Rule at index ${index}: Rule must be an object`);
    }
    const r = rule as Record<string, unknown>;

    // Validate file - can be string or string array
    const isFileString = typeof r.file === 'string';
    const isFileArray = Array.isArray(r.file) && r.file.length > 0 && r.file.every((f: unknown) => typeof f === 'string');

    if (!isFileString && !isFileArray) {
      throw new Error(`Rule at index ${index}: Rule.file must be a string or a non-empty array of strings`);
    }

    // Check if this is a directory rule with a known type
    const dirType = (typeof r.name === 'string' ? r.name : null) || (isFileString ? basename(r.file as string) : null);
    const isKnownDirType = dirType && isKnownDirectoryType(dirType);

    // 'to' is optional for known directory types, defaults to './'
    if (r.to === undefined && isKnownDirType) {
      r.to = './';
    } else if (typeof r.to !== 'string') {
      throw new Error(`Rule at index ${index}: Rule.to must be a string`);
    }
    if (r.mode !== undefined && r.mode !== 'copy' && r.mode !== 'symlink') {
      throw new Error(`Rule at index ${index}: Rule.mode must be "copy" or "symlink"`);
    }
    if (!Array.isArray(r.targets) || r.targets.length === 0) {
      throw new Error(`Rule at index ${index}: Rule.targets must be a non-empty array`);
    }

    const validAgentNames = ['claude', 'cursor', 'codex', 'roocode', 'opencode', 'generic'];

    // Check if all targets are valid agents
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

    // When file is an array (merge mode), all targets must be objects with 'to' property
    if (isFileArray) {
      const allTargetsAreObjects = r.targets.every((agent: unknown) => {
        return typeof agent === 'object' && agent !== null &&
               'name' in agent && 'to' in agent;
      });
      if (!allTargetsAreObjects) {
        throw new Error(`Rule at index ${index}: When using file array (merge mode), all targets must be objects with {name, to} properties`);
      }
    }
  }

  static createInitialConfig(): string {
    return this.createTypedConfig();
  }

  static createTypedConfig(): string {
    return `import { defineRules } from 'glooit';

export default defineRules({
  configDir: '.agents',
  mode: 'copy',
  rules: [
    {
      name: 'main',
      file: '.agents/main.md',
      to: './',
      targets: ['claude', 'cursor']
    }
  ],
});
`;
  }

  static createPlainConfig(): string {
    return `export default {
  configDir: '.agents',
  mode: 'copy',
  rules: [
    {
      name: 'main',
      file: '.agents/main.md',
      to: './',
      targets: ['claude', 'cursor']
    }
  ],
};
`;
  }

  private static isDirectoryPath(path: string): boolean {
    try {
      return existsSync(path) && statSync(path).isDirectory();
    } catch {
      return false;
    }
  }

}
