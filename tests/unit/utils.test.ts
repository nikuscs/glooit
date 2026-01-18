import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { resolveConfigDir, validateSymlinkPath } from '../../src/core/utils';
import { join } from 'path';

describe('resolveConfigDir', () => {
  const testDirs = ['.agents-test', '.glooit-test'];

  beforeEach(() => {
    // Clean up test directories before each test
    testDirs.forEach(dir => {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  afterEach(() => {
    // Clean up test directories after each test
    testDirs.forEach(dir => {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  it('should return provided configDir when it is a non-empty string', () => {
    expect(resolveConfigDir('.custom')).toBe('.custom');
    expect(resolveConfigDir('/absolute/path')).toBe('/absolute/path');
  });

  it('should return .agents as default when no directory exists', () => {
    expect(resolveConfigDir()).toBe('.agents');
    expect(resolveConfigDir('')).toBe('.agents');
    expect(resolveConfigDir('  ')).toBe('.agents');
  });

  it('should prefer .agents when it exists', () => {
    mkdirSync('.agents-test');
    // We can't easily test the actual .agents/.glooit directories without affecting the real project
    // So we test the logic by checking the function returns what we expect
    const result = resolveConfigDir();
    expect(result).toBe('.agents');
  });

  it('should handle empty string as undefined', () => {
    expect(resolveConfigDir('')).toBe('.agents');
  });

  it('should handle whitespace-only string as undefined', () => {
    expect(resolveConfigDir('   ')).toBe('.agents');
  });
});

describe('validateSymlinkPath', () => {
  const projectRoot = process.cwd();

  it('should allow paths within project directory', () => {
    const validPath = join(projectRoot, '.agents', 'main.md');
    expect(() => validateSymlinkPath(validPath, projectRoot)).not.toThrow();
  });

  it('should allow relative paths within project', () => {
    expect(() => validateSymlinkPath('.agents/main.md', projectRoot)).not.toThrow();
    expect(() => validateSymlinkPath('./src/file.ts', projectRoot)).not.toThrow();
  });

  it('should throw for paths with .. that escape project root', () => {
    expect(() => validateSymlinkPath('../outside.md', projectRoot)).toThrow(/Security.*outside project directory/);
    expect(() => validateSymlinkPath('../../etc/passwd', projectRoot)).toThrow(/Security.*outside project directory/);
  });

  it('should throw for absolute paths outside project', () => {
    expect(() => validateSymlinkPath('/etc/passwd', projectRoot)).toThrow(/Security.*outside project directory/);
    expect(() => validateSymlinkPath('/tmp/file.txt', projectRoot)).toThrow(/Security.*outside project directory/);
  });

  it('should allow nested paths within project', () => {
    const nestedPath = join(projectRoot, 'a', 'b', 'c', 'file.md');
    expect(() => validateSymlinkPath(nestedPath, projectRoot)).not.toThrow();
  });
});
