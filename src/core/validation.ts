import { existsSync } from 'fs';
import type { Config } from '../types';

export interface ValidationError {
  field: string;
  message: string;
  path?: string;
}

export class ConfigValidator {
  static async validate(config: Config): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const [index, rule] of config.rules.entries()) {
      if (!existsSync(rule.file)) {
        errors.push({
          field: `rules[${index}].file`,
          message: `Rule file not found: ${rule.file}`,
          path: rule.file
        });
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

    if (config.commands) {
      for (const [index, command] of config.commands.entries()) {
        if (!existsSync(command.file)) {
          errors.push({
            field: `commands[${index}].file`,
            message: `Command file not found: ${command.file}`,
            path: command.file
          });
        }

        if (command.targets.length === 0) {
          errors.push({
            field: `commands[${index}].targets`,
            message: 'At least one target must be specified'
          });
        }
      }
    }

    if (!config.configDir.startsWith('.') && !config.configDir.startsWith('/')) {
      errors.push({
        field: 'configDir',
        message: `Invalid config directory format: ${config.configDir}`
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