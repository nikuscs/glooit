import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, extname } from 'path';
import type { Config, AgentHook, AgentHookEvent } from '../types';

// Claude Code hook event names
type ClaudeHookEvent = 'PreToolUse' | 'PostToolUse' | 'Stop' | 'UserPromptSubmit';

// Cursor hook event names
type CursorHookEvent = 'beforeShellExecution' | 'afterShellExecution' | 'beforeFileEdit' | 'afterFileEdit' | 'beforeReadFile' | 'stop';

// Map unified event names to Claude Code events
const CLAUDE_EVENT_MAP: Partial<Record<AgentHookEvent, ClaudeHookEvent>> = {
  'PreToolUse': 'PreToolUse',
  'PostToolUse': 'PostToolUse',
  'Stop': 'Stop',
  'UserPromptSubmit': 'UserPromptSubmit',
  // Map Cursor-style events to Claude equivalents
  'beforeShellExecution': 'PreToolUse',
  'afterFileEdit': 'PostToolUse',
};

// Map unified event names to Cursor events
const CURSOR_EVENT_MAP: Partial<Record<AgentHookEvent, CursorHookEvent>> = {
  'beforeShellExecution': 'beforeShellExecution',
  'afterShellExecution': 'afterShellExecution',
  'beforeFileEdit': 'beforeFileEdit',
  'afterFileEdit': 'afterFileEdit',
  'beforeReadFile': 'beforeReadFile',
  'Stop': 'stop',
  // Map Claude-style events to Cursor equivalents
  'PostToolUse': 'afterFileEdit',
};

// Default matchers for Claude when mapping from Cursor events
const CLAUDE_DEFAULT_MATCHERS: Partial<Record<AgentHookEvent, string>> = {
  'beforeShellExecution': 'Bash',
  'afterShellExecution': 'Bash',
  'beforeFileEdit': 'Edit|Write',
  'afterFileEdit': 'Edit|Write',
  'beforeReadFile': 'Read',
};

interface ClaudeHookEntry {
  matcher: string;
  hooks: { type: 'command'; command: string; timeout?: number }[];
}

interface ClaudeSettings {
  hooks?: Record<string, ClaudeHookEntry[]>;
  [key: string]: unknown;
}

interface CursorHooksConfig {
  version: number;
  hooks: Record<string, { command: string }[]>;
}

export class AgentHooksDistributor {
  constructor(private config: Config) {}

  async distributeHooks(): Promise<void> {
    if (!this.config.hooks || this.config.hooks.length === 0) {
      return;
    }

    // Group hooks by target agent
    const claudeHooks: AgentHook[] = [];
    const cursorHooks: AgentHook[] = [];

    for (const hook of this.config.hooks) {
      for (const target of hook.targets) {
        if (target === 'claude') {
          claudeHooks.push(hook);
        } else if (target === 'cursor') {
          cursorHooks.push(hook);
        }
        // codex and roocode don't support hooks
      }
    }

    if (claudeHooks.length > 0) {
      await this.distributeClaudeHooks(claudeHooks);
    }

    if (cursorHooks.length > 0) {
      await this.distributeCursorHooks(cursorHooks);
    }
  }

  private async distributeClaudeHooks(hooks: AgentHook[]): Promise<void> {
    const settingsPath = '.claude/settings.json';

    // Load existing settings or create new
    let settings: ClaudeSettings = {};
    if (existsSync(settingsPath)) {
      try {
        settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      } catch {
        // Invalid JSON, start fresh
      }
    }

    if (!settings.hooks) {
      settings.hooks = {};
    }

    // Group hooks by event
    const hooksByEvent = new Map<ClaudeHookEvent, AgentHook[]>();

    for (const hook of hooks) {
      const claudeEvent = CLAUDE_EVENT_MAP[hook.event];
      if (!claudeEvent) {
        console.warn(`Event '${hook.event}' is not supported by Claude Code, skipping...`);
        continue;
      }

      if (!hooksByEvent.has(claudeEvent)) {
        hooksByEvent.set(claudeEvent, []);
      }
      hooksByEvent.get(claudeEvent)?.push(hook);
    }

    // Build Claude hooks config
    for (const [event, eventHooks] of hooksByEvent) {
      if (!settings.hooks[event]) {
        settings.hooks[event] = [];
      }

      for (const hook of eventHooks) {
        const command = this.buildCommand(hook);
        const matcher = hook.matcher || CLAUDE_DEFAULT_MATCHERS[hook.event] || '*';

        // Check if we already have a hook with this matcher
        const existingEntry = settings.hooks[event].find(h => h.matcher === matcher);

        if (existingEntry) {
          // Add to existing matcher's hooks
          existingEntry.hooks.push({ type: 'command', command });
        } else {
          // Create new entry
          settings.hooks[event].push({
            matcher,
            hooks: [{ type: 'command', command }]
          });
        }
      }
    }

    // Write settings
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  private async distributeCursorHooks(hooks: AgentHook[]): Promise<void> {
    const hooksPath = '.cursor/hooks.json';

    // Load existing config or create new
    let config: CursorHooksConfig = { version: 1, hooks: {} };
    if (existsSync(hooksPath)) {
      try {
        config = JSON.parse(readFileSync(hooksPath, 'utf-8'));
      } catch {
        // Invalid JSON, start fresh
      }
    }

    if (!config.hooks) {
      config.hooks = {};
    }

    // Group hooks by event
    for (const hook of hooks) {
      const cursorEvent = CURSOR_EVENT_MAP[hook.event];
      if (!cursorEvent) {
        console.warn(`Event '${hook.event}' is not supported by Cursor, skipping...`);
        continue;
      }

      if (!config.hooks[cursorEvent]) {
        config.hooks[cursorEvent] = [];
      }

      const command = this.buildCommand(hook);
      config.hooks[cursorEvent].push({ command });
    }

    // Write config
    mkdirSync(dirname(hooksPath), { recursive: true });
    writeFileSync(hooksPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  private buildCommand(hook: AgentHook): string {
    if (hook.command) {
      return hook.command;
    }

    if (hook.script) {
      const ext = extname(hook.script).toLowerCase();

      // Use bun for TS/JS files, sh for shell scripts
      if (ext === '.ts' || ext === '.mts') {
        return `bun run ${hook.script}`;
      } else if (ext === '.js' || ext === '.mjs') {
        return `node ${hook.script}`;
      } else {
        // Assume shell script
        return hook.script;
      }
    }

    throw new Error(`Hook must have either 'command' or 'script' defined`);
  }

  /**
   * Get all generated hook file paths for gitignore
   */
  getGeneratedPaths(): string[] {
    const paths: string[] = [];

    if (!this.config.hooks || this.config.hooks.length === 0) {
      return paths;
    }

    const hasClaudeHooks = this.config.hooks.some(h => h.targets.includes('claude'));
    const hasCursorHooks = this.config.hooks.some(h => h.targets.includes('cursor'));

    if (hasClaudeHooks) {
      paths.push('.claude/settings.json');
    }
    if (hasCursorHooks) {
      paths.push('.cursor/hooks.json');
    }

    return paths;
  }
}
