import { existsSync, statSync } from 'fs';
import type { Config, DirectorySync } from '../types';
import { KNOWN_DIRECTORY_TYPES } from '../agents';

export interface ValidationError {
  field: string;
  message: string;
  path?: string;
}

export class ConfigValidator {
  static async validate(config: Config): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const [index, rule] of config.rules.entries()) {
      // Handle both single file and array of files
      const files = Array.isArray(rule.file) ? rule.file : [rule.file];

      for (const file of files) {
        if (!existsSync(file)) {
          errors.push({
            field: `rules[${index}].file`,
            message: `Rule file not found: ${file}`,
            path: file
          });
        }
      }

      if (rule.targets.length === 0) {
        errors.push({
          field: `rules[${index}].targets`,
          message: 'At least one target must be specified'
        });
      }

      if (!rule.to.startsWith('./') && !rule.to.startsWith('/') && rule.to !== '.') {
        errors.push({
          field: `rules[${index}].to`,
          message: `Invalid path format: ${rule.to}. Use relative (./) or absolute (/) paths`
        });
      }
    }

    // Validate directory sync configs (commands, skills, agents)
    // Note: missing directories are silently skipped during sync, not errors
    for (const dirType of KNOWN_DIRECTORY_TYPES) {
      const dirConfig = config[dirType as keyof Config] as DirectorySync | undefined;
      if (dirConfig) {
        const path = typeof dirConfig === 'string' ? dirConfig : dirConfig.path;
        // Only validate if the path exists - if it doesn't, it's simply skipped during sync
        if (existsSync(path) && !statSync(path).isDirectory()) {
          errors.push({
            field: dirType,
            message: `${dirType} path is not a directory: ${path}`,
            path
          });
        }
      }
    }

    const configDir = config.configDir || '.glooit';
    if (!configDir.startsWith('.') && !configDir.startsWith('/')) {
      errors.push({
        field: 'configDir',
        message: `Invalid config directory format: ${configDir}`
      });
    }

    return errors;
  }

  static formatErrors(errors: ValidationError[]): string {
    if (errors.length === 0) {
      return 'Configuration is valid';
    }

    const lines = ['Configuration validation failed:', ''];

    for (const error of errors) {
      lines.push(`❌ ${error.field}: ${error.message}`);
      if (error.path) {
        lines.push(`   File: ${error.path}`);
      }
    }

    return lines.join('\n');
  }

  static hasErrors(errors: ValidationError[]) {
    return errors.length > 0;
  }
}