import { existsSync } from 'fs';
import { resolve, relative } from 'path';

/**
 * Resolves the configuration directory with legacy support.
 * Prefers .agents if present, falls back to .glooit, defaults to .agents.
 */
export function resolveConfigDir(configDir?: string): string {
  if (typeof configDir === 'string' && configDir.trim().length > 0) {
    return configDir;
  }
  // Prefer .agents if present, else fall back to legacy .glooit, else default to .agents
  if (existsSync('.agents')) return '.agents';
  if (existsSync('.glooit')) return '.glooit';
  return '.agents';
}

/**
 * Validates that a path is safe and within the project directory.
 * Prevents path traversal attacks by ensuring resolved path doesn't escape project root.
 *
 * @param sourcePath - The path to validate
 * @param projectRoot - The project root directory (defaults to cwd)
 * @throws Error if path is invalid or attempts to escape project root
 */
export function validateSymlinkPath(sourcePath: string, projectRoot: string = process.cwd()): void {
  const resolvedPath = resolve(sourcePath);
  const resolvedRoot = resolve(projectRoot);
  const relativePath = relative(resolvedRoot, resolvedPath);

  // Check if path escapes project root (starts with .. or is absolute)
  if (relativePath.startsWith('..') || resolve(relativePath) === relativePath) {
    throw new Error(
      `Security: Source path "${sourcePath}" is outside project directory. ` +
      `Symlinks must reference files within the project.`
    );
  }
}
