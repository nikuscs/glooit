import { existsSync } from 'fs';
import { join } from 'path';
import type { Config } from '../types';
import { ConfigSchema } from '../types';

export class ConfigLoader {
  private static readonly DEFAULT_CONFIG_PATHS = [
    'gloo.config.ts',
    'gloo.config.js',
    'config/gloo.ts',
    'config/gloo.js',
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
    return this.createTypedConfig();
  }

  static createTypedConfig(): string {
    return `import type { Config } from 'glooit';

export default {
  configDir: '.gloo',
  targets: ['claude', 'cursor'],

  rules: [
    {
      name: 'main',
      file: '.gloo/main.md',
      targets: ['claude', 'cursor']
    }
  ],

  mcps: [
    // {
    //   name: 'example-server',
    //   file: '.gloo/mcp.json',
    //   targets: ['claude']
    // }
  ]
} satisfies Config;
`;
  }

  static createPlainConfig(): string {
    return `export default {
  configDir: '.gloo',
  targets: ['claude', 'cursor'],

  rules: [
    {
      name: 'main',
      file: '.gloo/main.md',
      targets: ['claude', 'cursor']
    }
  ],

  mcps: [
    // {
    //   name: 'example-server',
    //   file: '.gloo/mcp.json',
    //   targets: ['claude']
    // }
  ]
};
`;
  }
}