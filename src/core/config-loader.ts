import { existsSync } from 'fs';
import { join } from 'path';
import type { Config } from '../types';
import { ConfigSchema } from '../types';

export class ConfigLoader {
  private static readonly DEFAULT_CONFIG_PATHS = [
    'ai-rules.config.ts',
    'ai-rules.config.js',
    'config/ai-rules.ts',
    'config/ai-rules.js',
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
        return ConfigSchema.parse(result);
      }

      return ConfigSchema.parse(config);
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

  static createInitialConfig(): string {
    return `import { defineRules } from 'ai-rules';

export default defineRules({
  configDir: '.ai-rules',

  rules: [
    {
      file: '.ai-rules/main.md',
      to: './',
      globs: '**/*',
      targets: ['claude', 'cursor', 'codex', 'roocode']
    }
  ],

  commands: [
    {
      command: 'cleanup',
      file: '.ai-rules/commands/cleanup.md',
      targets: ['claude', 'cursor']
    }
  ],

  backup: {
    enabled: true,
    retention: 10
  }
});
`;
  }
}