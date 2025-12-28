#!/usr/bin/env node

import { Command } from 'commander';
import { AIRulesCore } from '../core';
import { ConfigLoader } from '../core/config-loader';
import { ConfigValidator } from '../core/validation';
import { existsSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { GitIgnoreManager } from '../core/gitignore';
import { detect } from 'package-manager-detector/detect';
import { resolveCommand } from 'package-manager-detector/commands';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { version } from '../../package.json';

const args = process.argv.slice(2);

// Handle version flag like antfu's ni
if (args.length === 1 && (args[0]?.toLowerCase() === '-v' || args[0] === '--version')) {
  console.log(`v${version}`);
  process.exit(0);
}

const program = new Command();

program
  .name('glooit')
  .description('🧴 Sync your AI agent configurations and rules across platforms with ease');

program
  .command('init')
  .description('Initialize glooit configuration')
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
  .description('Remove all glooit generated files, backups, and config (start fresh)')
  .option('--force', 'skip confirmation prompt')
  .action(async (options) => {
    try {
      await resetCommand(options.force);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('upgrade')
  .description('Upgrade glooit to the latest version')
  .option('-g, --global', 'force global upgrade')
  .option('-l, --local', 'force local upgrade')
  .action(async (options) => {
    try {
      await upgradeCommand(options.global, options.local);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Command implementations

function promptUser(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}


async function initCommand(force: boolean): Promise<void> {
  const configPath = 'glooit.config.ts';

  if (existsSync(configPath) && !force) {
    throw new Error(`Configuration file ${configPath} already exists. Use --force to overwrite.`);
  }

  // Check if this is a JS/TS project
  if (!existsSync('package.json')) {
    // Non-JS project - create plain config
    const plainConfig = ConfigLoader.createPlainConfig();
    writeFileSync(configPath, plainConfig, 'utf-8');

    console.log(`✅ Created ${configPath}`);
    console.log('💡 For TypeScript support, create a package.json and add glooit to devDependencies');
    console.log('Next steps:');
    console.log('1. Edit the configuration file to match your project');
    console.log('2. Create your rule files in .glooit/');
    console.log('3. Run `glooit sync` to distribute rules');
    return;
  }

  // JS/TS project detected - try to add TypeScript support
  try {
    const pm = await detect();

    if (pm) {
      const resolved = resolveCommand(pm.agent, 'install', []);
      const installCmd = resolved ? `${resolved.command} ${resolved.args.join(' ')}` : `${pm.agent} install`;

      const shouldInstall = await promptUser(
        `📦 Add glooit to devDependencies and install for TypeScript support? (${pm.name}) [y/N]: `
      );

      if (shouldInstall) {
        // Add to devDependencies
        const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
        pkg.devDependencies = pkg.devDependencies || {};
        pkg.devDependencies.glooit = 'latest';
        writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

        // Create typed config
        const typedConfig = ConfigLoader.createTypedConfig();
        writeFileSync(configPath, typedConfig, 'utf-8');

        console.log(`✅ Created ${configPath}`);
        console.log('📦 Added glooit to devDependencies');

        // Auto-install
        try {
          console.log(`🔄 Installing dependencies with ${pm.name}...`);
          execSync(installCmd, { stdio: 'inherit' });
          console.log('✅ TypeScript support enabled!');
        } catch {
          console.log(`❌ Installation failed. Please run '${installCmd}' manually.`);
        }
      } else {
        // User declined - create plain config
        const plainConfig = ConfigLoader.createPlainConfig();
        writeFileSync(configPath, plainConfig, 'utf-8');

        console.log(`✅ Created ${configPath}`);
        console.log(`💡 Run 'npm install --save-dev glooit' later for TypeScript support`);
      }
    } else {
      // Couldn't detect package manager - create plain config
      const plainConfig = ConfigLoader.createPlainConfig();
      writeFileSync(configPath, plainConfig, 'utf-8');

      console.log(`✅ Created ${configPath}`);
      console.log('💡 Add glooit to devDependencies for TypeScript support');
    }
  } catch {
    // Fallback to plain config on any error
    const plainConfig = ConfigLoader.createPlainConfig();
    writeFileSync(configPath, plainConfig, 'utf-8');

    console.log(`✅ Created ${configPath}`);
    console.log('💡 Add glooit to devDependencies for TypeScript support');
  }

  console.log('Next steps:');
  console.log('1. Edit the configuration file to match your project');
  console.log('2. Create your rule files in the configured directory');
  console.log('3. Run `glooit sync` to distribute rules');
}

async function syncCommand(configPath?: string, createBackup = true): Promise<void> {
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
    console.log('⚠️  This will remove all glooit generated files, backups, and configuration.');
    console.log('Use --force to skip this confirmation.');
    return;
  }


  console.log('🗑️  Resetting glooit...');

  // Try to read config first to get all generated paths
  let generatedPaths: string[] = [];
  let customConfigDir: string | null = null;
  try {
    const config = await ConfigLoader.load();
    customConfigDir = config.configDir || null;
    const core = new AIRulesCore(config);
    generatedPaths = core.collectAllGeneratedPaths();
  } catch {
    // Config doesn't exist or can't be loaded, use default
    generatedPaths = ['.glooit']; // Default config directory
  }

  // Remove config files
  const configPaths = [
    'glooit.config.ts',
    'glooit.config.js',
    'config/glooit.ts',
    'config/glooit.js'
  ];

  for (const path of configPaths) {
    if (existsSync(path)) {
      rmSync(path);
      console.log(`   Removed ${path}`);
    }
  }

  // Add config directory to generated paths if not already included
  if (customConfigDir && !generatedPaths.includes(customConfigDir)) {
    generatedPaths.push(customConfigDir);
  }

  for (const path of generatedPaths) {
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
      console.log(`   Removed ${path}`);
    }
  }

  // Clean up empty parent directories from generated paths

  // Get unique parent directories from generated paths (max 2 levels up)
  const parentDirs = new Set<string>();
  for (const path of generatedPaths) {
    let parent = dirname(path);
    let level = 0;
    while (parent !== '.' && parent !== '/' && parent !== path && level < 2) {
      parentDirs.add(parent);
      parent = dirname(parent);
      level++;
    }
  }

  for (const dir of parentDirs) {
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
    const config = { configDir: '.glooit', rules: [], mcps: [], backup: { enabled: true, retention: 10 }, mergeMcps: false };
    const gitIgnoreManager = new GitIgnoreManager(config);
    await gitIgnoreManager.cleanupGitIgnore();
    console.log('   Cleaned .gitignore');
  } catch {
    // Ignore errors if gitignore cleanup fails
  }

  console.log('✅ Reset completed! Run `glooit init` to start fresh.');
}

async function upgradeCommand(forceGlobal: boolean, forceLocal: boolean): Promise<void> {
  const pm = await detect();
  const agent = pm?.agent || 'npm';

  // Determine if local or global
  let isLocal = existsSync('node_modules/glooit') || existsSync('package.json');

  if (forceGlobal) {
    isLocal = false;
  } else if (forceLocal) {
    isLocal = true;
  }

  console.log(`🔍 Detected package manager: ${agent}`);
  console.log(`📦 Upgrading glooit ${isLocal ? 'locally' : 'globally'}...`);

  let cmd: string;

  if (isLocal) {
    // Local upgrade - use the package manager's update/upgrade command
    const resolved = resolveCommand(agent, 'add', ['glooit@latest', '-D']);
    if (resolved) {
      cmd = `${resolved.command} ${resolved.args.join(' ')}`;
    } else {
      // Fallback
      cmd = agent === 'npm' ? 'npm install glooit@latest --save-dev'
        : agent === 'yarn' ? 'yarn add glooit@latest --dev'
        : agent === 'pnpm' ? 'pnpm add glooit@latest -D'
        : 'bun add glooit@latest -d';
    }
  } else {
    // Global upgrade
    const globalFlag = agent === 'npm' ? '-g'
      : agent === 'yarn' ? 'global'
      : agent === 'pnpm' ? '-g'
      : '-g';

    if (agent === 'yarn') {
      cmd = 'yarn global add glooit@latest';
    } else {
      const resolved = resolveCommand(agent, 'add', ['glooit@latest', globalFlag]);
      if (resolved) {
        cmd = `${resolved.command} ${resolved.args.join(' ')}`;
      } else {
        cmd = `${agent} install ${globalFlag} glooit@latest`;
      }
    }
  }

  console.log(`🔄 Running: ${cmd}`);

  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log('✅ glooit upgraded successfully!');

    // Show new version
    try {
      const newVersion = execSync('glooit -v', { encoding: 'utf-8' }).trim();
      console.log(`📦 New version: ${newVersion}`);
    } catch {
      // Ignore if version check fails
    }
  } catch {
    throw new Error(`Upgrade failed. Try running manually: ${cmd}`);
  }
}

program.parse();