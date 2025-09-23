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

    // Validate for duplicate MCP names
    this.validateMcpNames();

    const { AgentWriterFactory } = await import('../agents/writers');
    const { getMcpPath } = await import('../agents/mcp-paths');
    const { writeFileSync, mkdirSync } = await import('fs');
    const { dirname } = await import('path');

    // Expand MCPs for each target agent and group by output path
    const mcpGroups = new Map<string, Array<{ name: string, config: any, agent: string, outputPath: string }>>();

    for (const mcp of this.config.mcps) {
      for (const agent of mcp.targets) {
        const outputPath = getMcpPath(agent, mcp.outputPath);
        if (!mcpGroups.has(outputPath)) {
          mcpGroups.set(outputPath, []);
        }
        mcpGroups.get(outputPath)!.push({
          name: mcp.name,
          config: mcp.config,
          agent,
          outputPath
        });
      }
    }

    // Process each group
    for (const [outputPath, mcps] of mcpGroups) {
      const agent = mcps[0]?.agent; // All MCPs in group should have same agent
      if (!agent) continue;

      const writer = AgentWriterFactory.createWriter(agent as any);

      if (writer.formatMcp) {
        // Create directory if needed
        const dir = dirname(outputPath);
        if (dir !== '.') {
          mkdirSync(dir, { recursive: true });
        }

        // For multiple MCPs in the same file, we need to merge them
        // Start with existing config if merge is enabled
        let existingConfig: any = {};
        if (this.config.mergeMcps) {
          const { existsSync, readFileSync } = await import('fs');
          if (existsSync(outputPath)) {
            try {
              const content = readFileSync(outputPath, 'utf-8');
              existingConfig = JSON.parse(content);
            } catch {
              // If corrupted, start fresh
            }
          }
        }

        if (!existingConfig.mcpServers) {
          existingConfig.mcpServers = {};
        }

        // Add all MCPs to the config
        for (const mcp of mcps) {
          existingConfig.mcpServers[mcp.name] = mcp.config;
        }

        const finalConfig = JSON.stringify(existingConfig, null, 2);

        writeFileSync(outputPath, finalConfig, 'utf-8');
      }
    }
  }

  private validateMcpNames(): void {
    if (!this.config.mcps) return;

    const nameCount = new Map<string, number>();

    for (const mcp of this.config.mcps) {
      nameCount.set(mcp.name, (nameCount.get(mcp.name) || 0) + 1);
    }

    const duplicates = Array.from(nameCount.entries())
      .filter(([, count]) => count > 1)
      .map(([name]) => name);

    if (duplicates.length > 0) {
      throw new Error(`Duplicate MCP names found: ${duplicates.join(', ')}`);
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
      const { getMcpPath } = require('../agents/mcp-paths');
      for (const mcp of this.config.mcps) {
        for (const agent of mcp.targets) {
          const outputPath = getMcpPath(agent, mcp.outputPath);
          if (!paths.includes(outputPath)) {
            paths.push(outputPath);
          }
        }
      }
    }

    return paths;
  }
}