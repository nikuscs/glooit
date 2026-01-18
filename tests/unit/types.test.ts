import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { defineRules, type Config } from '../../src/types';
import { mkdirSync, rmSync, existsSync } from 'fs';

const testDir = 'test-types';

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
  process.chdir(testDir);
});

afterEach(() => {
  process.chdir('..');
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe('defineRules', () => {
  it('applies defaults and validates config', () => {
    mkdirSync('.agents', { recursive: true });
    const config: Config = defineRules({
      rules: [
        {
          file: '.agents/main.md',
          to: './',
          targets: ['claude']
        }
      ]
    });

    expect(config.configDir).toBe('.agents');
    expect(config.mergeMcps).toBe(true);
    expect(config.gitignore).toBe(true);
    expect(config.mode).toBe('copy');
  });

  it('applies defaults for backup and mcp targets', () => {
    const config: Config = defineRules({
      rules: [
        {
          file: 'rule.md',
          to: './',
          targets: ['claude']
        }
      ],
      backup: {},
      mcps: [
        {
          name: 'server',
          config: { command: 'node' }
        }
      ]
    });

    expect(config.backup?.enabled).toBe(true);
    expect(config.backup?.retention).toBe(10);
    expect(config.mcps?.[0]?.targets).toEqual(['claude']);
  });

  it('falls back to legacy .glooit when present', () => {
    mkdirSync('.glooit', { recursive: true });
    const config: Config = defineRules({
      rules: [
        {
          file: '.agents/main.md',
          to: './',
          targets: ['claude']
        }
      ]
    });

    expect(config.configDir).toBe('.glooit');
  });

  it('rejects invalid rule mode', () => {
    expect(() => {
      defineRules({
        rules: [
          {
            file: 'rule.md',
            to: './',
            targets: ['claude'],
            mode: 'bad' as 'copy'
          }
        ]
      });
    }).toThrow('Rule.mode must be "copy" or "symlink"');
  });

  it('rejects invalid config mode', () => {
    expect(() => {
      defineRules({
        mode: 'bad' as 'copy',
        rules: [
          {
            file: 'rule.md',
            to: './',
            targets: ['claude']
          }
        ]
      });
    }).toThrow('Config.mode must be "copy" or "symlink"');
  });

  it('rejects non-object configs', () => {
    expect(() => {
      defineRules(null as unknown as Config);
    }).toThrow('Config must be an object');
  });

  it('rejects non-array rules', () => {
    expect(() => {
      defineRules({
        rules: 'bad' as unknown as Config['rules']
      } as Config);
    }).toThrow('Config.rules must be an array');
  });

  it('rejects non-object rules', () => {
    expect(() => {
      defineRules({
        rules: [null as unknown as Config['rules'][0]]
      });
    }).toThrow('Rule must be an object');
  });

  it('rejects invalid target names', () => {
    expect(() => {
      defineRules({
        rules: [
          {
            file: 'rule.md',
            to: './',
            targets: ['unknown'] as unknown as Config['rules'][0]['targets']
          }
        ]
      });
    }).toThrow('Rule.targets must contain valid agents');
  });

  it('rejects non-string and non-object targets', () => {
    expect(() => {
      defineRules({
        rules: [
          {
            file: 'rule.md',
            to: './',
            targets: [123 as unknown as Config['rules'][0]['targets'][0]]
          }
        ]
      });
    }).toThrow('Rule.targets must contain valid agents');
  });

  it('rejects invalid target object shape', () => {
    expect(() => {
      defineRules({
        rules: [
          {
            file: 'rule.md',
            to: './',
            targets: [{ name: 'claude', to: 123 } as unknown as Config['rules'][0]['targets'][0]]
          }
        ]
      });
    }).toThrow('Rule.targets must contain valid agents');
  });

  it('rejects invalid file type', () => {
    expect(() => {
      defineRules({
        rules: [
          {
            file: 123 as unknown as string,
            to: './',
            targets: ['claude']
          }
        ]
      });
    }).toThrow('Rule.file must be a string or a non-empty array of strings');
  });

  it('rejects non-string rule.to', () => {
    expect(() => {
      defineRules({
        rules: [
          {
            file: 'rule.md',
            to: 123 as unknown as string,
            targets: ['claude']
          }
        ]
      });
    }).toThrow('Rule.to must be a string');
  });

  it('rejects empty targets', () => {
    expect(() => {
      defineRules({
        rules: [
          {
            file: 'rule.md',
            to: './',
            targets: []
          }
        ]
      });
    }).toThrow('Rule.targets must be a non-empty array');
  });

  it('requires object targets for merge rules', () => {
    expect(() => {
      defineRules({
        rules: [
          {
            file: ['a.md', 'b.md'],
            to: './',
            targets: ['claude']
          } as unknown as Rule
        ]
      });
    }).toThrow('When using file array (merge mode), all targets must be objects with {name, to} properties');
  });

  it('preserves custom configDir', () => {
    const config = defineRules({
      configDir: '.custom',
      rules: [
        {
          file: 'rule.md',
          to: './',
          targets: ['claude']
        }
      ]
    });

    expect(config.configDir).toBe('.custom');
  });

  it('accepts all known agent names', () => {
    const config = defineRules({
      rules: [
        { file: 'a.md', to: './', targets: ['claude', 'cursor', 'codex', 'roocode', 'opencode', 'generic'] }
      ]
    });

    expect(config.rules[0]?.targets.length).toBe(6);
  });
});
