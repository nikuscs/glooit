import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, rmdirSync } from 'fs';
import { dirname } from 'path';

interface Manifest {
  version: number;
  generatedFiles: string[];
  generatedDirectories: string[];
  generatedSymlinks: string[];
}

export class ManifestManager {
  private manifestPath: string;
  private currentVersion = 2;

  constructor(configDir = '.agents') {
    this.manifestPath = `${configDir}/manifest.json`;
  }

  private readManifest(): Manifest {
    if (!existsSync(this.manifestPath)) {
      return { version: this.currentVersion, generatedFiles: [], generatedDirectories: [], generatedSymlinks: [] };
    }

    try {
      const content = readFileSync(this.manifestPath, 'utf-8');
      const parsed = JSON.parse(content) as Manifest;
      /* istanbul ignore next -- defensive defaults for partial manifests */
      return {
        version: parsed.version ?? this.currentVersion,
        generatedFiles: parsed.generatedFiles ?? [],
        generatedDirectories: parsed.generatedDirectories ?? [],
        generatedSymlinks: parsed.generatedSymlinks ?? []
      };
    } catch {
      return { version: this.currentVersion, generatedFiles: [], generatedDirectories: [], generatedSymlinks: [] };
    }
  }

  private writeManifest(manifest: Manifest): void {
    const dir = dirname(this.manifestPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  private normalizePath(path: string): string {
    // Remove leading "./" for consistency
    return path.replace(/^\.\//, '');
  }

  getGeneratedFiles(): string[] {
    return this.readManifest().generatedFiles;
  }

  getGeneratedDirectories(): string[] {
    return this.readManifest().generatedDirectories;
  }

  getGeneratedSymlinks(): string[] {
    return this.readManifest().generatedSymlinks;
  }

  pruneStaleFiles(currentPaths: string[]): string[] {
    const manifest = this.readManifest();
    const normalizedCurrentPaths = currentPaths.map(p => this.normalizePath(p));

    // Separate files and directories
    const currentFiles = normalizedCurrentPaths.filter(p => !p.endsWith('/'));
    const currentDirs = normalizedCurrentPaths.filter(p => p.endsWith('/')).map(p => p.slice(0, -1));

    const removedPaths: string[] = [];

    // Remove stale files
    for (const file of manifest.generatedFiles) {
      if (!currentFiles.includes(file)) {
        if (existsSync(file)) {
          try {
            unlinkSync(file);
            removedPaths.push(file);
          } catch {
            // File might already be deleted or permission issue
          }
        }
      }
    }

    // Remove stale directories (only if empty)
    for (const dir of manifest.generatedDirectories) {
      /* istanbul ignore next -- cleanup-only branch */
      if (!currentDirs.includes(dir)) {
        if (existsSync(dir)) {
          try {
            // rmdirSync only works on empty directories, throws if not empty
            rmdirSync(dir);
            removedPaths.push(dir + '/');
          } catch {
            // Directory not empty or permission issue - that's fine
          }
        }
      }
    }

    return removedPaths;
  }

  updateManifest(currentPaths: string[], symlinkPaths: string[] = []): void {
    const normalizedPaths = currentPaths.map(p => this.normalizePath(p));
    const normalizedSymlinks = symlinkPaths.map(p => this.normalizePath(p));

    const files = normalizedPaths.filter(p => !p.endsWith('/'));
    const directories = normalizedPaths.filter(p => p.endsWith('/')).map(p => p.slice(0, -1));

    const manifest: Manifest = {
      version: this.currentVersion,
      generatedFiles: files.sort(),
      generatedDirectories: directories.sort(),
      generatedSymlinks: Array.from(new Set(normalizedSymlinks)).sort()
    };

    this.writeManifest(manifest);
  }

  clearManifest(): void {
    if (existsSync(this.manifestPath)) {
      unlinkSync(this.manifestPath);
    }
  }
}
