import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { ConfigValidator } from '../../src/core/validation';
import type { Config } from '../../src/types';

const testDir = 'test-validation-extra';
const testFile = `${testDir}/test.md`;

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
  writeFileSync(testFile, '# Test');
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe('ConfigValidator extra cases', () => {
  it('flags invalid configDir', async () => {
    const config: Config = {
      configDir: 'invalid',
      rules: [{ file: testFile, to: './', targets: ['claude'] }]
    };

    const errors = await ConfigValidator.validate(config);
    expect(errors.some(e => e.field === 'configDir')).toBe(true);
  });

  it('flags invalid mode on config and rule', async () => {
    const config: Config = {
      mode: 'bad' as 'copy',
      rules: [{ file: testFile, to: './', targets: ['claude'], mode: 'bad' as 'copy' }]
    };

    const errors = await ConfigValidator.validate(config);
    expect(errors.some(e => e.field === 'mode')).toBe(true);
    expect(errors.some(e => e.field === 'rules[0].mode')).toBe(true);
  });

  it('flags directory path that is not a directory', async () => {
    writeFileSync('not-a-dir', 'content');
    const config: Config = {
      rules: [],
      commands: 'not-a-dir'
    };

    const errors = await ConfigValidator.validate(config);
    expect(errors.some(e => e.field === 'commands')).toBe(true);
  });
});
