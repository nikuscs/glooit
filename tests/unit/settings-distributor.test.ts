import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { AIRulesCore } from '../../src/core';
import { AgentSettingsDistributor } from '../../src/agents/settings-distributor';
import type { Config } from '../../src/types';

describe('AgentSettingsDistributor', () => {
  const testDir = `/tmp/test-settings-distributor-${Date.now()}`;
  const originalCwd = process.cwd();

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('returns no generated paths when settings are absent', async () => {
    const distributor = new AgentSettingsDistributor({ rules: [] });
    await distributor.distributeSettings();
    expect(distributor.getGeneratedPaths()).toEqual([]);
  });

  it('returns default generated paths when settings are configured', () => {
    const distributor = new AgentSettingsDistributor({
      rules: [],
      settings: {
        env: ['GEMINI_API_KEY'],
      },
    });

    expect(distributor.getGeneratedPaths()).toEqual([
      '.claude/settings.local.json',
      '.cursor/cli.json',
      '.codex/config.toml',
      'opencode.json',
    ]);
  });

  it('returns custom target paths only when targets are specified', () => {
    const distributor = new AgentSettingsDistributor({
      rules: [],
      settings: {
        targets: ['claude', 'codex'],
        permissions: { allow: ['Read'] },
      },
    });

    expect(distributor.getGeneratedPaths()).toEqual([
      '.claude/settings.local.json',
      '.codex/config.toml',
    ]);
  });

  it('returns no generated paths for empty settings objects', () => {
    const distributor = new AgentSettingsDistributor({
      rules: [],
      settings: {},
    });

    expect(distributor.getGeneratedPaths()).toEqual([]);
  });

  it('merges Claude settings env and permissions using default env files', async () => {
    mkdirSync('.claude', { recursive: true });
    writeFileSync('.claude/settings.local.json', JSON.stringify({
      env: { EXISTING: 'keep' },
      permissions: { allow: ['Read'] },
      other: true,
    }, null, 2));
    writeFileSync('.env', 'GEMINI_API_KEY=from-env\nOPENAI_API_KEY=from-env\n');
    writeFileSync('.env.local', 'OPENAI_API_KEY=from-local\n');

    const config: Config = {
      rules: [],
      settings: {
        targets: ['claude'],
        env: ['GEMINI_API_KEY', 'OPENAI_API_KEY'],
        permissions: {
          deny: ['Bash'],
          nested: { strict: true },
        },
      },
    };

    const core = new AIRulesCore(config);
    await core.sync();

    const claude = JSON.parse(readFileSync('.claude/settings.local.json', 'utf-8'));
    expect(claude.env).toEqual({
      EXISTING: 'keep',
      GEMINI_API_KEY: 'from-env',
      OPENAI_API_KEY: 'from-local',
    });
    expect(claude.permissions).toEqual({
      allow: ['Read'],
      deny: ['Bash'],
      nested: { strict: true },
    });
    expect(claude.other).toBe(true);
  });

  it('resets settings content when merge is false', async () => {
    mkdirSync('.claude', { recursive: true });
    writeFileSync('.claude/settings.local.json', JSON.stringify({
      env: { OLD: 'old' },
      permissions: { allow: ['Read'] },
      old: true,
    }, null, 2));
    writeFileSync('.env.local', 'GEMINI_API_KEY=new\n');

    const core = new AIRulesCore({
      rules: [],
      settings: {
        targets: ['claude'],
        env: ['GEMINI_API_KEY'],
        merge: false,
      },
    });
    await core.sync();

    const claude = JSON.parse(readFileSync('.claude/settings.local.json', 'utf-8'));
    expect(claude).toEqual({
      env: {
        GEMINI_API_KEY: 'new',
      },
    });
  });

  it('writes Cursor CLI permissions and warns that env mapping is skipped', async () => {
    writeFileSync('.env.local', 'GEMINI_API_KEY=abc\n');
    const previousWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };

    try {
      const core = new AIRulesCore({
        rules: [],
        settings: {
          targets: ['cursor'],
          env: ['GEMINI_API_KEY'],
          permissions: {
            allow: ['Read'],
          },
        },
      });
      await core.sync();
    } finally {
      console.warn = previousWarn;
    }

    const cursor = JSON.parse(readFileSync('.cursor/cli.json', 'utf-8'));
    expect(cursor.permissions).toEqual({
      allow: ['Read'],
    });
    expect(warnings.some(w => w.includes('Settings env is not mapped for cursor'))).toBe(true);
    expect(warnings.some(w => w.includes('Cursor may ignore project-level permissions'))).toBe(true);
  });

  it('preserves unrelated Cursor CLI config while merging permissions', async () => {
    mkdirSync('.cursor', { recursive: true });
    writeFileSync(
      '.cursor/cli.json',
      JSON.stringify(
        {
          version: 1,
          editor: { vimMode: true },
          permissions: {
            allow: ['Read'],
            deny: ['Delete'],
          },
        },
        null,
        2
      )
    );

    const core = new AIRulesCore({
      rules: [],
      settings: {
        targets: ['cursor'],
        permissions: {
          allow: ['Read', 'Grep'],
        },
      },
    });
    await core.sync();

    const cursor = JSON.parse(readFileSync('.cursor/cli.json', 'utf-8'));
    expect(cursor.version).toBe(1);
    expect(cursor.editor).toEqual({ vimMode: true });
    expect(cursor.permissions).toEqual({
      allow: ['Read', 'Grep'],
      deny: ['Delete'],
    });
  });

  it('skips Cursor settings file creation when only env keys are provided', async () => {
    writeFileSync('.env.local', 'GEMINI_API_KEY=abc\n');
    const previousWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };

    try {
      const core = new AIRulesCore({
        rules: [],
        settings: {
          targets: ['cursor'],
          env: ['GEMINI_API_KEY'],
        },
      });
      await core.sync();
    } finally {
      console.warn = previousWarn;
    }

    expect(existsSync('.cursor/cli.json')).toBe(false);
    expect(warnings.some(w => w.includes('Settings env is not mapped for cursor'))).toBe(true);
  });

  it('writes OpenCode permission block and recovers from invalid existing JSON', async () => {
    writeFileSync('opencode.json', '{ invalid-json');

    const core = new AIRulesCore({
      rules: [],
      settings: {
        targets: ['opencode'],
        permissions: {
          bash: 'ask',
          edit: 'allow',
        },
      },
    });

    await core.sync();

    const opencode = JSON.parse(readFileSync('opencode.json', 'utf-8'));
    expect(opencode.permission).toEqual({
      bash: 'ask',
      edit: 'allow',
    });
  });

  it('deep-merges nested Claude permission objects', async () => {
    mkdirSync('.claude', { recursive: true });
    writeFileSync(
      '.claude/settings.local.json',
      JSON.stringify(
        {
          permissions: {
            tools: {
              bash: {
                mode: 'ask',
                timeout: 10,
              },
            },
          },
        },
        null,
        2
      )
    );

    const core = new AIRulesCore({
      rules: [],
      settings: {
        targets: ['claude'],
        permissions: {
          tools: {
            bash: {
              timeout: 30,
              network: true,
            },
          },
        },
      },
    });
    await core.sync();

    const claude = JSON.parse(readFileSync('.claude/settings.local.json', 'utf-8'));
    expect(claude.permissions).toEqual({
      tools: {
        bash: {
          mode: 'ask',
          timeout: 30,
          network: true,
        },
      },
    });
  });

  it('recursively merges Claude permissions without removing unrelated nested keys', async () => {
    mkdirSync('.claude', { recursive: true });
    writeFileSync(
      '.claude/settings.local.json',
      JSON.stringify(
        {
          permissions: {
            tools: {
              bash: {
                mode: 'ask',
                timeout: 10,
              },
              edit: {
                mode: 'allow',
              },
            },
            deny: ['Delete'],
          },
        },
        null,
        2
      )
    );

    const core = new AIRulesCore({
      rules: [],
      settings: {
        targets: ['claude'],
        permissions: {
          tools: {
            bash: {
              timeout: 30,
            },
          },
        },
      },
    });
    await core.sync();

    const claude = JSON.parse(readFileSync('.claude/settings.local.json', 'utf-8'));
    expect(claude.permissions).toEqual({
      tools: {
        bash: {
          mode: 'ask',
          timeout: 30,
        },
        edit: {
          mode: 'allow',
        },
      },
      deny: ['Delete'],
    });
  });

  it('writes and merges Codex TOML settings with env and shell policy', async () => {
    mkdirSync('.codex', { recursive: true });
    writeFileSync('.codex/config.toml', [
      'approval_policy = "never"',
      '',
      '[shell_environment_policy]',
      'set = { EXISTING = "yes" }',
      'include_only = ["PATH"]',
    ].join('\n'));
    writeFileSync('.env.local', 'GEMINI_API_KEY=from-local\n');

    const core = new AIRulesCore({
      rules: [],
      settings: {
        targets: ['codex'],
        env: ['GEMINI_API_KEY'],
        permissions: {
          approvalPolicy: 'on-request',
          sandboxMode: 'workspace-write',
          shellEnvironmentPolicy: {
            include_only: ['PATH', 'HOME'],
            inherit: false,
          },
        },
      },
    });
    await core.sync();

    const codex = readFileSync('.codex/config.toml', 'utf-8');
    expect(codex).toContain('approval_policy = "on-request"');
    expect(codex).toContain('sandbox_mode = "workspace-write"');
    expect(codex).toContain('[shell_environment_policy]');
    expect(codex).toContain('set = { EXISTING = "yes", GEMINI_API_KEY = "from-local" }');
    expect(codex).toContain('include_only = ["PATH", "HOME"]');
    expect(codex).toContain('inherit = false');
  });

  it('creates shell_environment_policy section when missing and inserts before next section', async () => {
    mkdirSync('.codex', { recursive: true });
    writeFileSync('.codex/config.toml', [
      'approval_policy = "never"',
      '[other_section]',
      'enabled = true',
    ].join('\n'));
    writeFileSync('.env.local', 'GEMINI_API_KEY=from-local\n');

    const core = new AIRulesCore({
      rules: [],
      settings: {
        targets: ['codex'],
        env: ['GEMINI_API_KEY'],
        permissions: {
          shellEnvironmentPolicy: {
            include_only: ['PATH'],
          },
        },
      },
    });
    await core.sync();

    const codex = readFileSync('.codex/config.toml', 'utf-8');
    expect(codex).toContain('[shell_environment_policy]');
    expect(codex).toContain('set = { GEMINI_API_KEY = "from-local" }');
    expect(codex).toContain('include_only = ["PATH"]');
    expect(codex).toContain('[other_section]');
  });

  it('preserves unrelated Codex TOML content when merge is true', async () => {
    mkdirSync('.codex', { recursive: true });
    writeFileSync('.codex/config.toml', [
      '# user-defined content',
      'model = "gpt-5"',
      '',
      '[profile.fast]',
      'reasoning = "low"',
      '',
      '[shell_environment_policy]',
      'include_only = ["PATH"]',
    ].join('\n'));
    writeFileSync('.env.local', 'GEMINI_API_KEY=from-local\n');

    const core = new AIRulesCore({
      rules: [],
      settings: {
        targets: ['codex'],
        env: ['GEMINI_API_KEY'],
        permissions: {
          approvalPolicy: 'on-request',
        },
      },
    });
    await core.sync();

    const codex = readFileSync('.codex/config.toml', 'utf-8');
    expect(codex).toContain('# user-defined content');
    expect(codex).toContain('model = "gpt-5"');
    expect(codex).toContain('[profile.fast]');
    expect(codex).toContain('reasoning = "low"');
    expect(codex).toContain('[shell_environment_policy]');
    expect(codex).toContain('include_only = ["PATH"]');
    expect(codex).toContain('set = { GEMINI_API_KEY = "from-local" }');
    expect(codex).toContain('approval_policy = "on-request"');
  });

  it('handles Codex set parsing edge cases while merging env values', async () => {
    mkdirSync('.codex', { recursive: true });
    writeFileSync('.codex/config.toml', [
      '[shell_environment_policy]',
      'set = { KEEP = "yes", BROKEN = 1 }',
      '[other]',
      'flag = true',
    ].join('\n'));
    writeFileSync('.env.local', 'GEMINI_API_KEY=from-local\n');

    const core = new AIRulesCore({
      rules: [],
      settings: {
        targets: ['codex'],
        env: ['GEMINI_API_KEY'],
        permissions: {
          shellEnvironmentPolicy: {
            set: {
              NEW_KEY: 'new',
            },
            fallback: null,
          },
        },
      },
    });
    await core.sync();

    const codex = readFileSync('.codex/config.toml', 'utf-8');
    expect(codex).toContain('set = { KEEP = "yes", NEW_KEY = "new", GEMINI_API_KEY = "from-local" }');
    expect(codex).toContain('fallback = ""');
  });

  it('handles empty and invalid pre-existing Codex set entries', async () => {
    mkdirSync('.codex', { recursive: true });
    writeFileSync('.env.local', 'GEMINI_API_KEY=from-local\n');

    writeFileSync('.codex/config.toml', '');
    await new AIRulesCore({
      rules: [],
      settings: {
        targets: ['codex'],
        env: ['GEMINI_API_KEY'],
      },
    }).sync();
    let codex = readFileSync('.codex/config.toml', 'utf-8');
    expect(codex).toContain('set = { GEMINI_API_KEY = "from-local" }');

    writeFileSync('.codex/config.toml', [
      '[shell_environment_policy]',
      'include_only = ["PATH"]',
    ].join('\n'));
    await new AIRulesCore({
      rules: [],
      settings: {
        targets: ['codex'],
        env: ['GEMINI_API_KEY'],
      },
    }).sync();
    codex = readFileSync('.codex/config.toml', 'utf-8');
    expect(codex).toContain('set = { GEMINI_API_KEY = "from-local" }');

    writeFileSync('.codex/config.toml', [
      '[shell_environment_policy]',
      'set = {}',
    ].join('\n'));
    await new AIRulesCore({
      rules: [],
      settings: {
        targets: ['codex'],
        env: ['GEMINI_API_KEY'],
      },
    }).sync();
    codex = readFileSync('.codex/config.toml', 'utf-8');
    expect(codex).toContain('set = { GEMINI_API_KEY = "from-local" }');

    writeFileSync('.codex/config.toml', [
      '[shell_environment_policy]',
      'set = "invalid"',
    ].join('\n'));
    await new AIRulesCore({
      rules: [],
      settings: {
        targets: ['codex'],
        env: ['GEMINI_API_KEY'],
      },
    }).sync();
    codex = readFileSync('.codex/config.toml', 'utf-8');
    expect(codex).toContain('set = { GEMINI_API_KEY = "from-local" }');
  });

  it('skips Codex writes when no supported settings are provided and warns about unknown keys', async () => {
    const previousWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };

    try {
      const core = new AIRulesCore({
        rules: [],
        settings: {
          targets: ['codex'],
          permissions: {
            unknown: true,
          },
        },
      });
      await core.sync();
    } finally {
      console.warn = previousWarn;
    }

    expect(existsSync('.codex/config.toml')).toBe(false);
    expect(warnings.some(w => w.includes('not mapped for codex') && w.includes('unknown'))).toBe(true);
  });

  it('warns for missing env keys and does not create files when nothing resolves', async () => {
    const previousWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };

    try {
      const core = new AIRulesCore({
        rules: [],
        settings: {
          targets: ['claude'],
          env: ['GEMINI_API_KEY'],
        },
      });
      await core.sync();
    } finally {
      console.warn = previousWarn;
    }

    expect(warnings.some(w => w.includes("Settings env key 'GEMINI_API_KEY' was not found"))).toBe(true);
    expect(existsSync('.claude/settings.local.json')).toBe(false);
  });

  it('refuses to write env values into git-tracked settings files', async () => {
    try {
      execSync('git --version', { stdio: 'ignore' });
    } catch {
      return;
    }

    execSync('git init', { stdio: 'ignore' });
    mkdirSync('.claude', { recursive: true });
    writeFileSync(
      '.claude/settings.local.json',
      JSON.stringify(
        {
          env: {
            SAFE: 'keep',
          },
        },
        null,
        2
      )
    );
    execSync('git add .claude/settings.local.json', { stdio: 'ignore' });
    writeFileSync('.env.local', 'GEMINI_API_KEY=secret\n');

    const before = readFileSync('.claude/settings.local.json', 'utf-8');
    const core = new AIRulesCore({
      rules: [],
      settings: {
        targets: ['claude'],
        env: ['GEMINI_API_KEY'],
      },
    });

    await expect(core.sync()).rejects.toThrow('Refusing to write env values into git-tracked settings files');
    const after = readFileSync('.claude/settings.local.json', 'utf-8');
    expect(after).toBe(before);
  });
});
