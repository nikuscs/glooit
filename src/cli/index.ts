#!/usr/bin/env node

import { Command } from 'commander';
import { AIRulesCore } from '../core';
import { ConfigLoader } from '../core/config-loader';
import { ConfigValidator } from '../core/validation';

const program = new Command();

program
  .name('ai-rules')
  .description('AI Rules - Reconcile AI agent configurations across platforms')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize ai-rules configuration')
  .option('-f, --force', 'overwrite existing configuration')
  .action(async (options) => {
    try {
      await initCommand(options.force);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('sync')
  .description('Sync rules to all configured agents')
  .option('-c, --config <path>', 'path to configuration file')
  .option('--no-backup', 'skip creating backup before sync')
  .action(async (options) => {
    try {
      await syncCommand(options.config, options.backup);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate configuration file')
  .option('-c, --config <path>', 'path to configuration file')
  .action(async (options) => {
    try {
      await validateCommand(options.config);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

const backupCommand = program
  .command('backup')
  .description('Manage backups');

backupCommand
  .command('list')
  .description('List available backups')
  .action(async () => {
    try {
      await listBackupsCommand();
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

backupCommand
  .command('restore')
  .description('Restore from backup')
  .argument('<timestamp>', 'backup timestamp to restore')
  .action(async (timestamp) => {
    try {
      await restoreCommand(timestamp);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Remove all generated files and clean .gitignore')
  .option('-c, --config <path>', 'path to configuration file')
  .action(async (options) => {
    try {
      await cleanCommand(options.config);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('reset')
  .description('Remove all generated files, backups, and config (start fresh)')
  .option('--force', 'skip confirmation prompt')
  .action(async (options) => {
    try {
      await resetCommand(options.force);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Command implementations

async function initCommand(force: boolean): Promise<void> {
  const { existsSync, writeFileSync } = await import('fs');

  const configPath = 'ai-rules.config.ts';

  if (existsSync(configPath) && !force) {
    console.error(`Configuration file ${configPath} already exists. Use --force to overwrite.`);
    return;
  }

  const initialConfig = ConfigLoader.createInitialConfig();
  writeFileSync(configPath, initialConfig, 'utf-8');

  console.log(`✅ Created ${configPath}`);
  console.log('Next steps:');
  console.log('1. Edit the configuration file to match your project');
  console.log('2. Create your rule files in .ai-rules/');
  console.log('3. Run `ai-rules sync` to distribute rules');
}

async function syncCommand(configPath?: string, createBackup: boolean = true): Promise<void> {
  const config = await ConfigLoader.load(configPath);
  const core = new AIRulesCore(config);

  console.log('🔄 Syncing AI rules...');

  if (createBackup) {
    console.log('📦 Creating backup...');
    await core.createBackup();
  }

  await core.sync();

  console.log('✅ Sync completed!');
}

async function validateCommand(configPath?: string): Promise<void> {
  try {
    const config = await ConfigLoader.load(configPath);
    const errors = await ConfigValidator.validate(config);

    const output = ConfigValidator.formatErrors(errors);
    console.log(output);

    if (ConfigValidator.hasErrors(errors)) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to load configuration:', error);
    process.exit(1);
  }
}

async function listBackupsCommand(): Promise<void> {
  const config = await ConfigLoader.load();
  const core = new AIRulesCore(config);

  const backups = core.listBackups();

  if (backups.length === 0) {
    console.log('No backups found');
    return;
  }

  console.log('Available backups:');
  backups.forEach(backup => {
    console.log(`  ${backup.timestamp} (${backup.fileCount} files)`);
  });
}

async function restoreCommand(timestamp: string): Promise<void> {
  const config = await ConfigLoader.load();
  const core = new AIRulesCore(config);

  console.log(`🔄 Restoring backup ${timestamp}...`);
  await core.restoreBackup(timestamp);
  console.log('✅ Backup restored!');
}

async function cleanCommand(configPath?: string): Promise<void> {
  const config = await ConfigLoader.load(configPath);
  const core = new AIRulesCore(config);

  console.log('🧹 Cleaning generated files...');
  await core.clean();
  console.log('✅ Cleanup completed!');
}

async function resetCommand(force: boolean): Promise<void> {
  if (!force) {
    // In a real implementation, we'd prompt the user for confirmation
    console.log('⚠️  This will remove all ai-rules generated files, backups, and configuration.');
    console.log('Use --force to skip this confirmation.');
    return;
  }

  const { existsSync, rmSync } = await import('fs');

  console.log('🗑️  Resetting ai-rules...');

  // Remove config files
  const configPaths = [
    'ai-rules.config.ts',
    'ai-rules.config.js',
    'config/ai-rules.ts',
    'config/ai-rules.js'
  ];

  for (const path of configPaths) {
    if (existsSync(path)) {
      rmSync(path);
      console.log(`   Removed ${path}`);
    }
  }

  // Remove generated directories and files
  const generatedPaths = [
    '.ai-rules',
    '.cursor/rules',
    '.roo/rules',
    'CLAUDE.md',
    'AGENTS.md',
    'claude_desktop_config.json'  // Common MCP config file
  ];

  for (const path of generatedPaths) {
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
      console.log(`   Removed ${path}`);
    }
  }

  // Clean up empty parent directories
  const { readdirSync } = await import('fs');
  const dirsToCheck = ['.cursor', '.roo', 'config', 'custom-rules', 'custom-ai-rules'];

  for (const dir of dirsToCheck) {
    try {
      if (existsSync(dir)) {
        const contents = readdirSync(dir);
        if (contents.length === 0) {
          rmSync(dir, { recursive: true, force: true });
          console.log(`   Removed empty directory ${dir}`);
        }
      }
    } catch {
      // Ignore errors when checking/removing directories
    }
  }

  // Clean .gitignore
  try {
    const config = { configDir: '.ai-rules', rules: [], commands: [] };
    const { GitIgnoreManager } = await import('../core/gitignore');
    const gitIgnoreManager = new GitIgnoreManager(config as any);
    await gitIgnoreManager.cleanupGitIgnore();
    console.log('   Cleaned .gitignore');
  } catch {
    // Ignore errors if gitignore cleanup fails
  }

  console.log('✅ Reset completed! Run `ai-rules init` to start fresh.');
}

program.parse();