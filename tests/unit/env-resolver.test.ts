import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { parseEnvContent, resolveEnvKeys } from '../../src/core/env-resolver';

describe('env resolver', () => {
  const testDir = `/tmp/test-env-resolver-${Date.now()}`;
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

  it('parses dotenv content with export, quotes, and ignores invalid lines', () => {
    const parsed = parseEnvContent([
      '# comment',
      'export A=one',
      'B="two\\nline"',
      "C='three'",
      'INVALID LINE',
      '1BAD=value',
      'D=plain',
    ].join('\n'));

    expect(parsed).toEqual({
      A: 'one',
      B: 'two\nline',
      C: 'three',
      D: 'plain',
    });
  });

  it('resolves from default env files and prefers .env.local over .env', () => {
    writeFileSync('.env', 'FROM_ENV=from-env\nOVERRIDE=from-env\nEMPTY_VALUE=\n');
    writeFileSync('.env.local', 'OVERRIDE=from-env-local\n');

    const resolved = resolveEnvKeys(
      ['FROM_ENV', 'OVERRIDE', 'EMPTY_VALUE'],
      undefined,
    );

    expect(resolved.values).toEqual({
      FROM_ENV: 'from-env',
      OVERRIDE: 'from-env-local',
      EMPTY_VALUE: '',
    });
    expect(resolved.missing).toEqual([]);
  });

  it('handles missing keys and missing files gracefully', () => {
    writeFileSync('.env.local', 'ONLY_LOCAL=local\n');

    const key = '__GLOOIT_TEST_MISSING_KEY__';
    delete process.env[key];

    const resolved = resolveEnvKeys(
      [key, 'ONLY_LOCAL'],
      ['.env', '.env.local'],
    );

    expect(resolved.values).toEqual({
      ONLY_LOCAL: 'local',
    });
    expect(resolved.missing).toEqual([key]);
  });

  it('falls back to process.env when key is not in env files', () => {
    const key = '__GLOOIT_TEST_PROCESS_ENV__';
    process.env[key] = 'from-process';

    try {
      const resolved = resolveEnvKeys([key], ['.env']);

      expect(resolved.values).toEqual({ [key]: 'from-process' });
      expect(resolved.missing).toEqual([]);
    } finally {
      delete process.env[key];
    }
  });

  it('prefers env file values over process.env', () => {
    const key = '__GLOOIT_TEST_FILE_WINS__';
    process.env[key] = 'from-process';
    writeFileSync('.env.local', `${key}=from-file\n`);

    try {
      const resolved = resolveEnvKeys([key], undefined);

      expect(resolved.values).toEqual({ [key]: 'from-file' });
    } finally {
      delete process.env[key];
    }
  });

  it('returns empty result when keys are empty or undefined', () => {
    expect(resolveEnvKeys([], ['.env'])).toEqual({ values: {}, missing: [] });
    expect(resolveEnvKeys(undefined, ['.env'])).toEqual({ values: {}, missing: [] });
  });

  it('uses explicit envFiles order when provided', () => {
    writeFileSync('.env', 'DUPLICATE=from-env\n');
    writeFileSync('.env.local', 'DUPLICATE=from-env-local\n');

    const resolved = resolveEnvKeys(
      ['DUPLICATE'],
      ['.env', '.env.local'],
    );

    expect(resolved.values).toEqual({
      DUPLICATE: 'from-env',
    });
  });
});
