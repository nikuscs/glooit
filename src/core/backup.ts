import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import type { BackupEntry, Config } from '../types';

export class BackupManager {
  private backupDir: string;

  constructor(private config: Config) {
    this.backupDir = join(config.configDir || '.glooit', 'backups');
    // Don't create backup dir in constructor - only when actually needed
  }

  async createBackup(filePaths: string[]): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupEntry: BackupEntry = {
      timestamp,
      files: []
    };

    // Ensure backup directory exists before creating backup
    this.ensureBackupDir();

    for (const filePath of filePaths) {
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf-8');
          backupEntry.files.push({ path: filePath, content });
        } catch (error) {
          console.warn(`Failed to backup ${filePath}: ${error}`);
        }
      } else {
        console.warn(`File not found for backup: ${filePath}`);
      }
    }

    if (backupEntry.files.length > 0) {
      const backupPath = join(this.backupDir, `${timestamp}.json`);
      writeFileSync(backupPath, JSON.stringify(backupEntry, null, 2), 'utf-8');

      await this.cleanupOldBackups();

      return timestamp;
    }

    return '';
  }

  async restoreBackup(timestamp: string): Promise<boolean> {
    const backupPath = join(this.backupDir, `${timestamp}.json`);

    if (!existsSync(backupPath)) {
      throw new Error(`Backup ${timestamp} not found`);
    }

    try {
      const backupContent = readFileSync(backupPath, 'utf-8');
      const backup: BackupEntry = JSON.parse(backupContent);

      for (const file of backup.files) {
        const dir = file.path.substring(0, file.path.lastIndexOf('/'));
        if (dir) {
          mkdirSync(dir, { recursive: true });
        }

        writeFileSync(file.path, file.content, 'utf-8');
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to restore backup ${timestamp}: ${error}`);
    }
  }

  listBackups(): { timestamp: string; fileCount: number }[] {
    if (!existsSync(this.backupDir)) {
      return [];
    }

    const backupFiles = readdirSync(this.backupDir)
      .filter(file => file.endsWith('.json'))
      .sort()
      .reverse();

    return backupFiles.map(file => {
      const timestamp = file.replace('.json', '');
      try {
        const content = readFileSync(join(this.backupDir, file), 'utf-8');
        const backup: BackupEntry = JSON.parse(content);
        return { timestamp, fileCount: backup.files.length };
      } catch {
        return { timestamp, fileCount: 0 };
      }
    });
  }

  private ensureBackupDir(): void {
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    const retention = this.config.backup?.retention || 10;
    const backups = this.listBackups();

    if (backups.length > retention) {
      const toDelete = backups.slice(retention);

      for (const backup of toDelete) {
        try {
          const backupPath = join(this.backupDir, `${backup.timestamp}.json`);
          if (existsSync(backupPath)) {
            // TODO: Implement actual file deletion
            console.log(`Would delete old backup: ${backup.timestamp}`);
          }
        } catch (error) {
          console.warn(`Failed to delete backup ${backup.timestamp}: ${error}`);
        }
      }
    }
  }
}