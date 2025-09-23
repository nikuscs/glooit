import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

describe('CLI - Backup Commands', () => {
  const testDir = 'test-cli-backup';
  const originalCwd = process.cwd();

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('backup list', () => {
    it('should list backups successfully when backups exist', () => {
      const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.ai-rules',
  rules: [
    {
      file: 'test.md',
      to: './',
      targets: ['claude']
    }
  ],
  backup: {
    enabled: true,
    retention: 5
  }
} satisfies Config;
`;
      writeFileSync('ai-rules.config.ts', config);
      writeFileSync('test.md', '# Test content');

      const cliPath = `${originalCwd}/src/cli/index.ts`;

      // Sync to create files (this will also create a backup)
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      // List backups
      const result = execSync(`bun run ${cliPath} backup list`, {
        encoding: 'utf-8'
      });

      expect(result).toContain('Available backups:');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/); // timestamp pattern
    });

    it('should show no backups when none exist', () => {
      const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.ai-rules',
  rules: []
} satisfies Config;
`;
      writeFileSync('ai-rules.config.ts', config);

      const cliPath = `${originalCwd}/src/cli/index.ts`;
      const result = execSync(`bun run ${cliPath} backup list`, {
        encoding: 'utf-8'
      });

      expect(result).toContain('No backups found');
    });
  });

  describe('backup restore', () => {
    it('should restore backup successfully', () => {
      const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.ai-rules',
  rules: [
    {
      file: 'test.md',
      to: './',
      targets: ['claude']
    }
  ],
  backup: {
    enabled: true,
    retention: 5
  }
} satisfies Config;
`;
      writeFileSync('ai-rules.config.ts', config);
      writeFileSync('test.md', '# Original content');

      const cliPath = `${originalCwd}/src/cli/index.ts`;

      // First sync to create files and backup
      execSync(`bun run ${cliPath} sync`, { encoding: 'utf-8' });

      // Get list of backups to find a timestamp
      const listResult = execSync(`bun run ${cliPath} backup list`, {
        encoding: 'utf-8'
      });

      // Extract timestamp from the list output
      const timestampMatch = listResult.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
      expect(timestampMatch).toBeTruthy();
      const timestamp = timestampMatch![1];

      // Modify the file
      writeFileSync('CLAUDE.md', '# Modified content');

      // Restore backup
      const restoreResult = execSync(`bun run ${cliPath} backup restore ${timestamp}`, {
        encoding: 'utf-8'
      });

      expect(restoreResult).toContain('✅ Backup restored!');

      // Verify content was restored
      const restoredContent = readFileSync('CLAUDE.md', 'utf-8');
      expect(restoredContent).toContain('# Original content');
    });

    it('should fail to restore non-existent backup', () => {
      const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.ai-rules',
  rules: []
} satisfies Config;
`;
      writeFileSync('ai-rules.config.ts', config);

      const cliPath = `${originalCwd}/src/cli/index.ts`;

      expect(() => {
        execSync(`bun run ${cliPath} backup restore fake-timestamp`, {
          encoding: 'utf-8'
        });
      }).toThrow();
    });

    it('should require timestamp argument for restore', () => {
      const config = `
import { Config } from '@ai-rules/types';

export default {
  configDir: '.ai-rules',
  rules: []
} satisfies Config;
`;
      writeFileSync('ai-rules.config.ts', config);

      const cliPath = `${originalCwd}/src/cli/index.ts`;

      expect(() => {
        execSync(`bun run ${cliPath} backup restore`, {
          encoding: 'utf-8'
        });
      }).toThrow();
    });
  });

  it('should fail backup commands when config file is missing', () => {
    const cliPath = `${originalCwd}/src/cli/index.ts`;

    expect(() => {
      execSync(`bun run ${cliPath} backup list`, { encoding: 'utf-8' });
    }).toThrow();

    expect(() => {
      execSync(`bun run ${cliPath} backup restore timestamp`, { encoding: 'utf-8' });
    }).toThrow();
  });
});