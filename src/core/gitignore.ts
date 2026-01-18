import { existsSync, readFileSync, writeFileSync } from 'fs';
import type { Config, Agent, AgentName, DirectorySync } from '../types';
import { getAgentPath, getAgentDirectory, KNOWN_DIRECTORY_TYPES, getAgentDirectoryPath } from '../agents';

export class GitIgnoreManager {
  private gitignorePath = '.gitignore';
  private marker = '# glooit generated files';

  constructor(private config: Config) {}

  private getAgentName(agent: Agent): AgentName {
    return typeof agent === 'string' ? agent : agent.name;
  }

  private getCustomPath(agent: Agent): string | undefined {
    return typeof agent === 'object' ? agent.to : undefined;
  }

  async updateGitIgnore(): Promise<void> {
    const paths = this.collectGeneratedPaths();

    if (paths.length === 0) {
      return;
    }

    let gitignoreContent = '';

    if (existsSync(this.gitignorePath)) {
      gitignoreContent = readFileSync(this.gitignorePath, 'utf-8');
    }

    gitignoreContent = this.removeExistingSection(gitignoreContent);

    if (paths.length > 0) {
      const newSection = this.createIgnoreSection(paths);
      gitignoreContent = gitignoreContent.trim() + '\n\n' + newSection;
    }

    writeFileSync(this.gitignorePath, gitignoreContent, 'utf-8');
  }

  async cleanupGitIgnore(): Promise<void> {
    if (!existsSync(this.gitignorePath)) {
      return;
    }

    const gitignoreContent = readFileSync(this.gitignorePath, 'utf-8');
    const cleanedContent = this.removeExistingSection(gitignoreContent);

    writeFileSync(this.gitignorePath, cleanedContent, 'utf-8');
  }

  private normalizeGitignorePath(path: string): string {
    // Remove leading "./" as gitignore patterns don't use this syntax
    return path.replace(/^\.\//, '');
  }

  private collectGeneratedPaths(): string[] {
    // If global gitignore is disabled, return empty array
    if (this.config.gitignore === false) {
      return [];
    }

    const paths = new Set<string>();

    for (const rule of this.config.rules) {
      // Skip this rule if it has gitignore explicitly disabled
      if (rule.gitignore === false) {
        continue;
      }

      for (const agent of rule.targets) {
        const agentName = this.getAgentName(agent);
        const customPath = this.getCustomPath(agent);

        if (customPath) {
          paths.add(this.normalizeGitignorePath(customPath));
        } else {
          const filePath = Array.isArray(rule.file) ? rule.file[0] ?? '' : rule.file;
          const ruleName = this.extractRuleName(filePath);
          const agentPath = getAgentPath(agentName, ruleName);
          const fullPath = `${rule.to}/${agentPath}`.replace(/\/+/g, '/');

          paths.add(this.normalizeGitignorePath(fullPath));

          const agentDir = getAgentDirectory(agentName);
          if (agentDir) {
            const fullDir = `${rule.to}/${agentDir}`.replace(/\/+/g, '/');
            paths.add(this.normalizeGitignorePath(`${fullDir}/`));
          }
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
        if (dirPath) {
          paths.add(this.normalizeGitignorePath(dirPath + '/'));
        }
      }
    }

    if (this.config.mcps) {
      for (const mcp of this.config.mcps) {
        if (mcp.outputPath) {
          paths.add(this.normalizeGitignorePath(mcp.outputPath));
        }
      }
    }

    // Always add manifest file to gitignore
    const manifestPath = `${this.config.configDir || '.agents'}/manifest.json`;
    paths.add(this.normalizeGitignorePath(manifestPath));

    return Array.from(paths).sort();
  }

  private extractRuleName(filePath: string): string {
    const fileName = filePath.split('/').pop();
    return fileName ? fileName.replace('.md', '') : 'rule';
  }

  private createIgnoreSection(paths: string[]): string {
    const lines = [
      this.marker,
      ...paths
    ];

    return lines.join('\n');
  }

  private removeExistingSection(content: string): string {
    const lines = content.split('\n');
    const markerIndex = lines.findIndex(line => line.trim() === this.marker);

    if (markerIndex === -1) {
      return content;
    }

    let endIndex = markerIndex + 1;
    while (endIndex < lines.length) {
      const line = lines[endIndex]?.trim();
      if (line === '') {
        endIndex++;
        break;
      }
      if (line?.startsWith('/') || line?.startsWith('.') || line?.includes('.md') || line?.includes('.json')) {
        endIndex++;
      } else {
        break;
      }
    }

    lines.splice(markerIndex, endIndex - markerIndex);

    while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
      lines.pop();
    }

    return lines.join('\n');
  }
}
