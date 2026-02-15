import { existsSync, readFileSync } from 'fs';

const DEFAULT_ENV_FILES = ['.env.agents', '.env.local', '.env'];

function unquote(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const inner = trimmed.slice(1, -1);
    return inner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function parseEnvContent(content: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const withoutExport = trimmed.startsWith('export ')
      ? trimmed.slice('export '.length).trim()
      : trimmed;

    const separatorIndex = withoutExport.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = withoutExport.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    const rawValue = withoutExport.slice(separatorIndex + 1);
    parsed[key] = unquote(rawValue);
  }

  return parsed;
}

function loadEnvFiles(envFiles: string[]): Record<string, string>[] {
  const loaded: Record<string, string>[] = [];

  for (const file of envFiles) {
    if (!existsSync(file)) {
      loaded.push({});
      continue;
    }

    const content = readFileSync(file, 'utf-8');
    loaded.push(parseEnvContent(content));
  }

  return loaded;
}

export interface ResolvedEnvResult {
  values: Record<string, string>;
  missing: string[];
}

export function resolveEnvKeys(keys: string[] | undefined, envFiles: string[] | undefined): ResolvedEnvResult {
  const values: Record<string, string> = {};
  const missing: string[] = [];

  if (!keys || keys.length === 0) {
    return { values, missing };
  }

  const filesToLoad = envFiles && envFiles.length > 0 ? envFiles : DEFAULT_ENV_FILES;
  const fileMaps = loadEnvFiles(filesToLoad);

  for (const key of keys) {
    let fileValue: string | undefined;
    for (const fileMap of fileMaps) {
      if (Object.prototype.hasOwnProperty.call(fileMap, key)) {
        fileValue = fileMap[key];
        break;
      }
    }

    if (fileValue !== undefined) {
      values[key] = fileValue;
      continue;
    }

    // Fall back to process.env
    const envValue = process.env[key];
    if (envValue !== undefined) {
      values[key] = envValue;
      continue;
    }

    missing.push(key);
  }

  return { values, missing };
}
