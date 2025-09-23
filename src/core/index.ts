import type { Config, Agent, AgentName, McpConfig } from '../types';

interface McpGroupItem {
  name: string;
  config: McpConfig;
  agent: string;
  outputPath: string;
}

interface McpConfigFile {
  mcpServers?: Record<string, unknown>;
}
import { AgentDistributor } from '../agents/distributor';
import { BackupManager } from './backup';
import { GitIgnoreManager } from './gitignore';
import { getAgentPath, getAgentMcpPath } from '../agents';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { AgentWriterFactory } from '../agents/writers';

export class AIRulesCore {
  private distributor: AgentDistributor;
  private backupManager: BackupManager;
  private gitIgnoreManager: GitIgnoreManager;

  constructor(private config: Config) {
    this.distributor = new AgentDistributor(config);
    this.backupManager = new BackupManager(config);
    this.gitIgnoreManager = new GitIgnoreManager(config);
  }

  async sync(): Promise<void> {
    try {
      if (this.config.hooks?.before) {
        for (const hook of this.config.hooks.before) {
          await hook({ config: this.config });
        }
      }

      for (const rule of this.config.rules) {
        await this.distributor.distributeRule(rule);
      }

      if (this.config.commands) {
        for (const command of this.config.commands) {
          const commandRule = {
            file: command.file,
            to: './',
            targets: command.targets
          };
          await this.distributor.distributeRule(commandRule);
        }
      }

      if (this.config.mcps) {
        await this.distributeMcps();
      }

      await this.gitIgnoreManager.updateGitIgnore();

    } catch (error) {
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

  listBackups(): { timestamp: string; fileCount: number }[] {
    return this.backupManager.listBackups();
  }

  async clean(): Promise<void> {
    // Clean .gitignore
    await this.gitIgnoreManager.cleanupGitIgnore();
  }

  async validate(): Promise<boolean> {
    try {
      for (const rule of this.config.rules) {
        if (!existsSync(rule.file)) {
          throw new Error(`Rule file not found: ${rule.file}`);
        }
      }

      if (this.config.commands) {
        for (const command of this.config.commands) {
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

    this.validateMcpNames();

    // Expand MCPs for each target agent and group by output path
    const mcpGroups = new Map<string, McpGroupItem[]>();

    for (const mcp of this.config.mcps) {
      for (const agent of mcp.targets || ['claude']) {
        const outputPath = mcp.outputPath || getAgentMcpPath(agent);
        if (!mcpGroups.has(outputPath)) {
          mcpGroups.set(outputPath, []);
        }
        const group = mcpGroups.get(outputPath);
        if (group) {
          group.push({
            name: mcp.name,
            config: mcp.config,
            agent,
            outputPath
          });
        }
      }
    }

    for (const [outputPath, mcps] of mcpGroups) {
      const agent = mcps[0]?.agent;
      if (!agent) continue;

      const writer = AgentWriterFactory.createWriter(agent as AgentName);

      if (writer.formatMcp) {
        const dir = dirname(outputPath);
        if (dir !== '.') {
          mkdirSync(dir, { recursive: true });
        }

        let existingConfig: McpConfigFile = {};
        if (this.config.mergeMcps) {
          if (existsSync(outputPath)) {
            try {
              const content = readFileSync(outputPath, 'utf-8');
              existingConfig = JSON.parse(content);
            } catch {
            }
          }
        }

        if (!existingConfig.mcpServers) {
          existingConfig.mcpServers = {};
        }

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

  private getAgentName(agent: Agent): AgentName {
    return typeof agent === 'string' ? agent : agent.name;
  }

  private getCustomPath(agent: Agent): string | undefined {
    return typeof agent === 'object' ? agent.to : undefined;
  }

  collectAllGeneratedPaths(): string[] {
    const paths: string[] = [];

    for (const rule of this.config.rules) {
      for (const agent of rule.targets) {
        const agentName = this.getAgentName(agent);
        const customPath = this.getCustomPath(agent);

        if (customPath) {
          paths.push(customPath);
        } else {
          const ruleName = rule.file.split('/').pop()?.replace('.md', '') || 'rule';
          const agentPath = getAgentPath(agentName, ruleName);
          let fullPath = `${rule.to}/${agentPath}`.replace(/\/+/g, '/');
          if (fullPath.startsWith('./')) {
            fullPath = fullPath.substring(2);
          }
          paths.push(fullPath);
        }
      }
    }

    if (this.config.commands) {
      for (const command of this.config.commands) {
        for (const agent of command.targets) {
          const agentName = this.getAgentName(agent);
          const customPath = this.getCustomPath(agent);

          if (customPath) {
            paths.push(customPath);
          } else {
            const agentPath = getAgentPath(agentName, command.command);
            paths.push(agentPath);
          }
        }
      }
    }

    if (this.config.mcps) {
      for (const mcp of this.config.mcps) {
        for (const agent of mcp.targets || ['claude']) {
          const outputPath = mcp.outputPath || getAgentMcpPath(agent);
          if (!paths.includes(outputPath)) {
            paths.push(outputPath);
          }
        }
      }
    }

    return paths;
  }
}