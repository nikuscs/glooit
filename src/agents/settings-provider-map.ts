import { SETTINGS_TARGETS, type SettingsTarget } from '../types';

export const DEFAULT_SETTINGS_TARGETS: SettingsTarget[] = SETTINGS_TARGETS;

export const SETTINGS_PATHS: Record<SettingsTarget, string> = {
  claude: '.claude/settings.local.json',
  cursor: '.cursor/cli.json',
  codex: '.codex/config.toml',
  opencode: 'opencode.json',
};

export function getSettingsPath(target: SettingsTarget): string {
  return SETTINGS_PATHS[target];
}

export function supportsStoredEnv(target: SettingsTarget): boolean {
  return target === 'claude' || target === 'codex';
}

export function resolveSettingsTargets(targets: SettingsTarget[] | undefined): SettingsTarget[] {
  return targets && targets.length > 0 ? targets : DEFAULT_SETTINGS_TARGETS;
}
