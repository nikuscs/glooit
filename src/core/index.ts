import type { Config, Agent, AgentName, McpConfig, DirectorySync } from '../types';
import { KNOWN_DIRECTORY_TYPES, getAgentDirectoryPath } from '../agents';

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
import { AgentHooksDistributor } from '../agents/hooks-distributor';
import { BackupManager } from './backup';
import { GitIgnoreManager } from './gitignore';
import { ManifestManager } from './manifest';
import { getAgentPath, getAgentMcpPath } from '../agents';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { AgentWriterFactory } from '../agents/writers';

export class AIRulesCore {
  private distributor: AgentDistributor;
  private hooksDistributor: AgentHooksDistributor;
  private backupManager: BackupManager;
  private gitIgnoreManager: GitIgnoreManager;
  private manifestManager: ManifestManager;

  constructor(private config: Config) {
    this.distributor = new AgentDistributor(config);
    this.hooksDistributor = new AgentHooksDistributor(config);
    this.backupManager = new BackupManager(config);
    this.gitIgnoreManager = new GitIgnoreManager(config);
    this.manifestManager = new ManifestManager();
  }

  async sync(): Promise<void> {
    try {
      if (this.config.transforms?.before) {
        for (const transform of this.config.transforms.before) {
          await transform({ config: this.config });
        }
      }

      // Collect expected paths before sync
      const expectedPaths = this.collectAllGeneratedPaths();

      // Prune stale files that are no longer in config
      this.manifestManager.pruneStaleFiles(expectedPaths);

      for (const rule of this.config.rules) {
        await this.distributor.distributeRule(rule);
      }

      // Sync top-level directories (commands, skills, agents)
      await this.syncDirectories();

      if (this.config.mcps) {
        await this.distributeMcps();
      }

      // Distribute agent lifecycle hooks (Claude Code, Cursor)
      if (this.config.hooks) {
        await this.hooksDistributor.distributeHooks();
      }

      await this.gitIgnoreManager.updateGitIgnore();

      // Update manifest with current paths
      this.manifestManager.updateManifest(expectedPaths);

    } catch (error) {
      if (this.config.transforms?.error) {
        for (const transform of this.config.transforms.error) {
          await transform(error);
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
    // Prune all tracked files (pass empty array to remove everything tracked)
    this.manifestManager.pruneStaleFiles([]);

    // Clean .gitignore
    await this.gitIgnoreManager.cleanupGitIgnore();

    // Clear the manifest
    this.manifestManager.clearManifest();
  }

  async validate(): Promise<boolean> {
    try {
      for (const rule of this.config.rules) {
        const files = Array.isArray(rule.file) ? rule.file : [rule.file];
        for (const file of files) {
          if (!existsSync(file)) {
            throw new Error(`Rule file not found: ${file}`);
          }
        }
      }

      // Note: directory sync paths (commands, skills, agents) are optional
      // If they don't exist, they're silently skipped during sync

      return true;
    } catch {
      return false;
    }
  }

  private async syncDirectories(): Promise<void> {
    for (const dirType of KNOWN_DIRECTORY_TYPES) {
      const dirConfig = this.config[dirType as keyof Config] as DirectorySync | undefined;
      if (!dirConfig) continue;

      const path = typeof dirConfig === 'string' ? dirConfig : dirConfig.path;

      // Skip if directory doesn't exist (graceful handling)
      if (!existsSync(path)) {
        continue;
      }

      const targets = typeof dirConfig === 'string'
        ? ['claude', 'cursor'] as AgentName[]
        : (dirConfig.targets || ['claude', 'cursor']);

      // Create a rule for the directory sync
      const rule = {
        name: dirType,
        file: path,
        to: './',
        targets: targets.map(t => t as AgentName)
      };

      await this.distributor.distributeRule(rule);
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
          const firstFile = Array.isArray(rule.file) ? rule.file[0] ?? '' : rule.file;
          const ruleName = firstFile.split('/').pop()?.replace('.md', '') || 'rule';
          const agentPath = getAgentPath(agentName, ruleName);
          let fullPath = `${rule.to}/${agentPath}`.replace(/\/+/g, '/');
          if (fullPath.startsWith('./')) {
            fullPath = fullPath.substring(2);
          }
          paths.push(fullPath);
        }
      }
    }

    // Add paths for directory sync (commands, skills, agents)
    for (const dirType of KNOWN_DIRECTORY_TYPES) {
      const dirConfig = this.config[dirType as keyof Config] as DirectorySync | undefined;
      if (!dirConfig) continue;

      const targets = typeof dirConfig === 'string'
        ? ['claude', 'cursor'] as AgentName[]
        : (dirConfig.targets || ['claude', 'cursor']);

      for (const agent of targets) {
        const dirPath = getAgentDirectoryPath(agent, dirType);
        if (dirPath && !paths.includes(dirPath)) {
          paths.push(dirPath);
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

    // Add agent hook config paths
    const hookPaths = this.hooksDistributor.getGeneratedPaths();
    for (const hookPath of hookPaths) {
      if (!paths.includes(hookPath)) {
        paths.push(hookPath);
      }
    }

    return paths;
  }
}