import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { execFileSync } from 'child_process';
import { resolveEnvKeys } from '../core/env-resolver';
import type { Config, SettingsConfig, SettingsTarget } from '../types';
import { getSettingsPath, resolveSettingsTargets, supportsStoredEnv } from './settings-provider-map';

type JsonObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(base: JsonObject, override: JsonObject): JsonObject {
  const result: JsonObject = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMerge(existing, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function normalizeStringMap(value: unknown): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!isPlainObject(value)) {
    return normalized;
  }

  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') {
      normalized[key] = item;
    }
  }

  return normalized;
}

function toObject(value: unknown): JsonObject {
  if (!isPlainObject(value)) {
    return {};
  }
  return value;
}

function escapeTomlString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function toTomlValue(value: unknown): string {
  if (typeof value === 'string') {
    return `"${escapeTomlString(value)}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value.map(item => toTomlValue(item));
    return `[${items.join(', ')}]`;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value).map(([key, item]) => {
      return `${key} = ${toTomlValue(item)}`;
    });
    return `{ ${entries.join(', ')} }`;
  }
  return '""';
}

function getTomlSectionBounds(lines: string[], sectionName: string): { start: number; end: number } | null {
  const sectionHeader = `[${sectionName}]`;
  const start = lines.findIndex(line => line.trim() === sectionHeader);
  if (start < 0) {
    return null;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const trimmed = lines[i]?.trim() || '';
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      end = i;
      break;
    }
  }

  return { start, end };
}

function upsertTomlScalar(content: string, key: string, value: unknown): string {
  const lines = content.length > 0 ? content.split('\n') : [];
  const keyPrefix = `${key} = `;
  const nextLine = `${key} = ${toTomlValue(value)}`;

  // Only match top-level keys (before the first section header)
  let topLevelEnd = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]?.trim() || '';
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      topLevelEnd = i;
      break;
    }
  }

  let index = -1;
  for (let i = 0; i < topLevelEnd; i++) {
    if (lines[i]?.trim().startsWith(keyPrefix)) {
      index = i;
      break;
    }
  }

  if (index >= 0) {
    lines[index] = nextLine;
  } else {
    // Insert before the first section header (or at end if no sections)
    lines.splice(topLevelEnd, 0, nextLine);
  }

  return lines.join('\n').trimEnd() + '\n';
}

function upsertTomlSectionEntry(content: string, section: string, key: string, value: unknown): string {
  const lines = content.length > 0 ? content.split('\n') : [];
  const bounds = getTomlSectionBounds(lines, section);
  const entryLine = `${key} = ${toTomlValue(value)}`;

  if (!bounds) {
    if (lines.length > 0 && lines[lines.length - 1]?.trim() !== '') {
      lines.push('');
    }
    lines.push(`[${section}]`);
    lines.push(entryLine);
    return lines.join('\n').trimEnd() + '\n';
  }

  const sectionLines = lines.slice(bounds.start, bounds.end);
  const localIndex = sectionLines.findIndex(line => line.trim().startsWith(`${key} = `));

  if (localIndex >= 0) {
    lines[bounds.start + localIndex] = entryLine;
  } else {
    lines.splice(bounds.end, 0, entryLine);
  }

  return lines.join('\n').trimEnd() + '\n';
}

function parseTomlInlineTable(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return result;
  }

  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return result;
  }

  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of inner) {
    if (ch === '"' && (current.length === 0 || current[current.length - 1] !== '\\')) {
      inQuotes = !inQuotes;
    }
    if (ch === ',' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) {
    parts.push(current);
  }

  for (const part of parts) {
    const match = part.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"((?:\\.|[^"])*)"$/);
    if (!match || !match[1]) {
      continue;
    }
    result[match[1]] = (match[2] || '')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  return result;
}

function readTomlSectionStringMap(content: string, section: string, key: string): Record<string, string> {
  if (!content) {
    return {};
  }

  const lines = content.split('\n');
  const bounds = getTomlSectionBounds(lines, section);
  if (!bounds) {
    return {};
  }

  const sectionLines = lines.slice(bounds.start + 1, bounds.end);
  const entry = sectionLines.find(line => line.trim().startsWith(`${key} = `));
  if (!entry) {
    return {};
  }

  const value = entry.split('=').slice(1).join('=').trim();
  return parseTomlInlineTable(value);
}

function getGitTrackedPaths(paths: string[]): string[] {
  if (paths.length === 0) {
    return [];
  }

  try {
    const output = execFileSync('git', ['ls-files', '--', ...paths], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.split(/\r?\n/).filter(Boolean);
  } catch {
    // Not in a git repo, git unavailable, or no tracked matches.
    return [];
  }
}

export class AgentSettingsDistributor {
  constructor(private config: Config) {}

  async distributeSettings(): Promise<void> {
    const settings = this.config.settings;
    if (!settings) {
      return;
    }

    const targets = this.resolveTargets(settings);
    const { values: envValues, missing } = resolveEnvKeys(settings.env, settings.envFiles);
    const hasPermissions = isPlainObject(settings.permissions) && Object.keys(settings.permissions).length > 0;
    const hasEnv = Object.keys(envValues).length > 0;

    for (const key of missing) {
      console.warn(`Settings env key '${key}' was not found in env files.`);
    }

    const envWriteTargets = hasEnv ? targets.filter(target => supportsStoredEnv(target)) : [];
    if (envWriteTargets.length > 0) {
      const trackedPaths = getGitTrackedPaths(envWriteTargets.map(target => getSettingsPath(target)));
      if (trackedPaths.length > 0) {
        const trackedList = trackedPaths.map(path => `- ${path}`).join('\n');
        console.warn(
          [
            'WARNING: Refusing to write settings env values into git-tracked files.',
            'Tracked files:',
            trackedList,
            'Untrack these files (or remove settings.env) before running sync again.',
          ].join('\n')
        );
        throw new Error(`Refusing to write env values into git-tracked settings files: ${trackedPaths.join(', ')}`);
      }
    }

    if (!hasPermissions && !hasEnv) {
      return;
    }

    for (const target of targets) {
      const outputPath = getSettingsPath(target);
      const merge = settings.merge !== false;

      if (target === 'codex') {
        this.writeCodexSettings(outputPath, envValues, toObject(settings.permissions), merge);
        continue;
      }

      if (target === 'cursor' && hasPermissions) {
        console.warn(
          'Note: Cursor may ignore project-level permissions in .cursor/cli.json due to security restrictions. ' +
          'Consider setting permissions in the global ~/.cursor/cli-config.json instead.'
        );
      }

      if ((target === 'cursor' || target === 'opencode') && hasEnv) {
        console.warn(`Settings env is not mapped for ${target}; skipping env values for that target.`);
      }

      if (target === 'opencode') {
        this.writeJsonSettings({
          outputPath,
          merge,
          permissionKey: 'permission',
          includeEnv: false,
          envValues,
          permissions: toObject(settings.permissions),
        });
        continue;
      }

      this.writeJsonSettings({
        outputPath,
        merge,
        permissionKey: 'permissions',
        includeEnv: supportsStoredEnv(target),
        envValues,
        permissions: toObject(settings.permissions),
      });
    }
  }

  getGeneratedPaths(): string[] {
    const settings = this.config.settings;
    if (!settings) {
      return [];
    }

    const hasEnvKeys = Array.isArray(settings.env) && settings.env.length > 0;
    const hasPermissions = isPlainObject(settings.permissions) && Object.keys(settings.permissions).length > 0;
    if (!hasEnvKeys && !hasPermissions) {
      return [];
    }

    return this.resolveTargets(settings).map(target => getSettingsPath(target));
  }

  private resolveTargets(settings: SettingsConfig): SettingsTarget[] {
    return resolveSettingsTargets(settings.targets);
  }

  private writeJsonSettings(options: {
    outputPath: string;
    merge: boolean;
    permissionKey: 'permission' | 'permissions';
    includeEnv: boolean;
    envValues: Record<string, string>;
    permissions: JsonObject;
  }): void {
    const hasEnvData = options.includeEnv && Object.keys(options.envValues).length > 0;
    const hasPermissionData = Object.keys(options.permissions).length > 0;
    if (!hasEnvData && !hasPermissionData) {
      return;
    }

    let existing: JsonObject = {};
    if (options.merge && existsSync(options.outputPath)) {
      try {
        existing = JSON.parse(readFileSync(options.outputPath, 'utf-8')) as JsonObject;
      } catch {
        existing = {};
      }
    }

    const next: JsonObject = { ...existing };

    if (options.includeEnv && Object.keys(options.envValues).length > 0) {
      const existingEnv = normalizeStringMap(next.env);
      next.env = {
        ...existingEnv,
        ...options.envValues,
      };
    }

    if (Object.keys(options.permissions).length > 0) {
      const existingPermissions = toObject(next[options.permissionKey]);
      next[options.permissionKey] = deepMerge(existingPermissions, options.permissions);
    }

    mkdirSync(dirname(options.outputPath), { recursive: true });
    writeFileSync(options.outputPath, JSON.stringify(next, null, 2), 'utf-8');
  }

  private static CODEX_KNOWN_KEYS = new Set([
    'approval_policy', 'approvalPolicy',
    'sandbox_mode', 'sandboxMode',
    'shell_environment_policy', 'shellEnvironmentPolicy',
  ]);

  private writeCodexSettings(
    outputPath: string,
    envValues: Record<string, string>,
    permissions: JsonObject,
    merge: boolean,
  ): void {
    const unknownKeys = Object.keys(permissions).filter(k => !AgentSettingsDistributor.CODEX_KNOWN_KEYS.has(k));
    if (unknownKeys.length > 0) {
      console.warn(
        `Settings permissions keys not mapped for codex (ignored): ${unknownKeys.join(', ')}. ` +
        `Codex supports: approval_policy, sandbox_mode, shell_environment_policy.`
      );
    }

    let content = '';
    if (merge && existsSync(outputPath)) {
      content = readFileSync(outputPath, 'utf-8');
    }

    let shouldWrite = false;

    const approvalPolicy = permissions.approval_policy ?? permissions.approvalPolicy;
    if (approvalPolicy !== undefined) {
      content = upsertTomlScalar(content, 'approval_policy', approvalPolicy);
      shouldWrite = true;
    }

    const sandboxMode = permissions.sandbox_mode ?? permissions.sandboxMode;
    if (sandboxMode !== undefined) {
      content = upsertTomlScalar(content, 'sandbox_mode', sandboxMode);
      shouldWrite = true;
    }

    const shellPolicyRaw = permissions.shell_environment_policy ?? permissions.shellEnvironmentPolicy;
    const shellPolicy = toObject(shellPolicyRaw);
    const shellPolicySet = normalizeStringMap(shellPolicy.set);
    const existingSet = merge ? readTomlSectionStringMap(content, 'shell_environment_policy', 'set') : {};
    const mergedSet = {
      ...existingSet,
      ...shellPolicySet,
      ...envValues,
    };

    if (Object.keys(mergedSet).length > 0) {
      content = upsertTomlSectionEntry(content, 'shell_environment_policy', 'set', mergedSet);
      shouldWrite = true;
    }

    for (const [key, value] of Object.entries(shellPolicy)) {
      if (key === 'set') {
        continue;
      }
      content = upsertTomlSectionEntry(content, 'shell_environment_policy', key, value);
      shouldWrite = true;
    }

    if (!shouldWrite) {
      return;
    }

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content.trimEnd() + '\n', 'utf-8');
  }
}
