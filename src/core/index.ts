import type { Config } from '../types';
import { AgentDistributor } from '../agents/distributor';
import { BackupManager } from './backup';
import { GitIgnoreManager } from './gitignore';
import { HookManager } from '../hooks';

export class AIRulesCore {
  private distributor: AgentDistributor;
  private backupManager: BackupManager;
  private gitIgnoreManager: GitIgnoreManager;
  private hookManager: HookManager;

  constructor(private config: Config) {
    this.distributor = new AgentDistributor(config);
    this.backupManager = new BackupManager(config);
    this.gitIgnoreManager = new GitIgnoreManager(config);
    this.hookManager = new HookManager();
  }

  async sync(): Promise<void> {
    try {
      // Execute before hooks
      if (this.config.hooks?.before) {
        for (const hook of this.config.hooks.before) {
          await hook({ config: this.config });
        }
      }

      // Distribute rules
      for (const rule of this.config.rules) {
        await this.distributor.distributeRule(rule);
      }

      // Distribute commands
      if (this.config.commands) {
        for (const command of this.config.commands) {
          // Commands are treated like rules but with a different naming pattern
          const commandRule = {
            file: command.file,
            to: './',
            targets: command.targets
          };
          await this.distributor.distributeRule(commandRule);
        }
      }

      // Handle MCP configurations
      if (this.config.mcps) {
        await this.distributeMcps();
      }

      // Update .gitignore
      await this.gitIgnoreManager.updateGitIgnore();

    } catch (error) {
      // Execute error hooks
      if (this.config.hooks?.error) {
        for (const hook of this.config.hooks.error) {
          await hook(error);
        }
      }
      throw error;
    }
  }

  async createBackup(): Promise<string> {
    if (!this.config.backup?.enabled) {
      return '';
    }

    const paths = this.collectAllGeneratedPaths();
    return await this.backupManager.createBackup(paths);
  }

  async restoreBackup(timestamp: string): Promise<void> {
    await this.backupManager.restoreBackup(timestamp);
  }

  listBackups(): Array<{ timestamp: string; fileCount: number }> {
    return this.backupManager.listBackups();
  }

  async clean(): Promise<void> {
    // This would remove all generated files - implementation depends on requirements
    console.log('Clean functionality would be implemented here');

    // Clean .gitignore
    await this.gitIgnoreManager.cleanupGitIgnore();
  }

  async validate(): Promise<boolean> {
    try {
      // Validate that all rule files exist
      for (const rule of this.config.rules) {
        const { existsSync } = await import('fs');
        if (!existsSync(rule.file)) {
          throw new Error(`Rule file not found: ${rule.file}`);
        }
      }

      // Validate command files
      if (this.config.commands) {
        for (const command of this.config.commands) {
          const { existsSync } = await import('fs');
          if (!existsSync(command.file)) {
            throw new Error(`Command file not found: ${command.file}`);
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  private async distributeMcps(): Promise<void> {
    if (!this.config.mcps) return;

    for (const mcp of this.config.mcps) {
      const outputPath = mcp.outputPath || 'claude_desktop_config.json';

      // Read existing config if it exists
      let existingConfig: any = {};
      try {
        const { existsSync, readFileSync } = await import('fs');
        if (existsSync(outputPath)) {
          const content = readFileSync(outputPath, 'utf-8');
          existingConfig = JSON.parse(content);
        }
      } catch {
        // Ignore errors, start with empty config
      }

      // Ensure mcpServers section exists
      if (!existingConfig.mcpServers) {
        existingConfig.mcpServers = {};
      }

      // Add/update MCP configuration
      existingConfig.mcpServers[mcp.name] = mcp.config;

      // Write updated config
      const { writeFileSync } = await import('fs');
      writeFileSync(outputPath, JSON.stringify(existingConfig, null, 2), 'utf-8');
    }
  }

  private collectAllGeneratedPaths(): string[] {
    const paths: string[] = [];

    // Collect rule-generated paths
    for (const rule of this.config.rules) {
      for (const agent of rule.targets) {
        const { getAgentPath } = require('../agents');
        const ruleName = rule.file.split('/').pop()?.replace('.md', '') || 'rule';
        const agentPath = getAgentPath(agent, ruleName);
        let fullPath = `${rule.to}/${agentPath}`.replace(/\/+/g, '/');
        // Remove leading "./" to match actual file paths
        if (fullPath.startsWith('./')) {
          fullPath = fullPath.substring(2);
        }
        paths.push(fullPath);
      }
    }

    // Collect command-generated paths
    if (this.config.commands) {
      for (const command of this.config.commands) {
        for (const agent of command.targets) {
          const { getAgentPath } = require('../agents');
          const agentPath = getAgentPath(agent, command.command);
          paths.push(agentPath);
        }
      }
    }

    // Collect MCP output paths
    if (this.config.mcps) {
      for (const mcp of this.config.mcps) {
        if (mcp.outputPath) {
          paths.push(mcp.outputPath);
        }
      }
    }

    return paths;
  }
}