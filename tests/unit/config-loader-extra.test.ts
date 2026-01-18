import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { ConfigLoader } from '../../src/core/config-loader';

const testDir = 'test-config-extra';

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

describe('ConfigLoader extra coverage', () => {
  it('loads ts config and defaults known directory rule to ./', async () => {
    writeFileSync(
      'glooit.config.ts',
      `export default {
  rules: [
    { name: 'commands', file: '.agents/commands', targets: ['claude'] }
  ]
};\n`
    );

    const config = await ConfigLoader.load('glooit.config.ts');
    expect(config.rules[0]?.to).toBe('./');
  });

  it('validate returns true for a valid config', async () => {
    writeFileSync(
      'glooit.validate.config.ts',
      `export default { rules: [{ file: 'rules.md', to: './', targets: ['claude'] }] };\n`
    );

    const result = await ConfigLoader.validate('glooit.validate.config.ts');
    expect(result).toBe(true);
  });

  it('loads function-exported configs', async () => {
    writeFileSync(
      'glooit.func.config.ts',
      `export default () => ({ rules: [{ file: 'rules.md', to: './', targets: ['claude'] }] });\n`
    );

    const config = await ConfigLoader.load('glooit.func.config.ts');
    expect(config.rules.length).toBe(1);
  });

  it('throws when no config file is found', async () => {
    mkdirSync('empty', { recursive: true });
    process.chdir('empty');

    await expect(ConfigLoader.load()).rejects.toThrow('No configuration file found');

    process.chdir('..');
  });

  it('findConfigFile returns null when no config exists', () => {
    mkdirSync('empty2', { recursive: true });
    process.chdir('empty2');

    const result = (ConfigLoader as unknown as { findConfigFile: () => string | null }).findConfigFile();
    expect(result).toBeNull();

    process.chdir('..');
  });

  it('rejects invalid target types', async () => {
    writeFileSync(
      'glooit.invalid.config.ts',
      `export default {
  rules: [
    { file: 'rules.md', to: './', targets: [123] }
  ]
};\n`
    );

    await expect(ConfigLoader.load('glooit.invalid.config.ts')).rejects.toThrow(
      'Rule.targets must contain valid agents'
    );
  });

  it('rejects non-object config exports', async () => {
    writeFileSync('glooit.null.config.js', 'export default 123;\n');

    await expect(ConfigLoader.load('glooit.null.config.js')).rejects.toThrow(
      'Config must be an object'
    );
  });

  it('rejects invalid config mode', async () => {
    writeFileSync(
      'glooit.badmode.config.ts',
      `export default { mode: 'bad', rules: [{ file: 'rules.md', to: './', targets: ['claude'] }] };\n`
    );

    await expect(ConfigLoader.load('glooit.badmode.config.ts')).rejects.toThrow(
      'Config.mode must be \"copy\" or \"symlink\"'
    );
  });

  it('rejects invalid rule file type', async () => {
    writeFileSync(
      'glooit.badfile.config.ts',
      `export default { rules: [{ file: 123, to: './', targets: ['claude'] }] };\n`
    );

    await expect(ConfigLoader.load('glooit.badfile.config.ts')).rejects.toThrow(
      'Rule.file must be a string or a non-empty array of strings'
    );
  });
});
