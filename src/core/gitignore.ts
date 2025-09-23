import { existsSync, readFileSync, writeFileSync } from 'fs';
import type { Config } from '../types';
import { getAgentPath, getAgentDirectory } from '../agents';

export class GitIgnoreManager {
  private gitignorePath = '.gitignore';
  private marker = '# ai-rules generated files';

  constructor(private config: Config) {}

  async updateGitIgnore(): Promise<void> {
    const paths = this.collectGeneratedPaths();

    if (paths.length === 0) {
      return;
    }

    let gitignoreContent = '';

    if (existsSync(this.gitignorePath)) {
      gitignoreContent = readFileSync(this.gitignorePath, 'utf-8');
    }

    // Remove existing ai-rules section
    gitignoreContent = this.removeExistingSection(gitignoreContent);

    // Add new section
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

  private collectGeneratedPaths(): string[] {
    const paths = new Set<string>();

    // Add rule-generated paths
    for (const rule of this.config.rules) {
      for (const agent of rule.targets) {
        const ruleName = this.extractRuleName(rule.file);
        const agentPath = getAgentPath(agent, ruleName);
        const fullPath = `${rule.to}/${agentPath}`.replace(/\/+/g, '/');

        paths.add(fullPath);

        // Add agent directories
        const agentDir = getAgentDirectory(agent);
        if (agentDir) {
          const fullDir = `${rule.to}/${agentDir}`.replace(/\/+/g, '/');
          paths.add(`${fullDir}/`);
        }
      }
    }

    // Add command-generated paths
    if (this.config.commands) {
      for (const command of this.config.commands) {
        for (const agent of command.targets) {
          const agentPath = getAgentPath(agent, command.command);
          paths.add(agentPath);
        }
      }
    }

    // Add MCP output paths
    if (this.config.mcps) {
      for (const mcp of this.config.mcps) {
        if (mcp.outputPath) {
          paths.add(mcp.outputPath);
        }
      }
    }

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

    // Find the end of the section - continue until we find an empty line or a line that looks like user content
    let endIndex = markerIndex + 1;
    while (endIndex < lines.length) {
      const line = lines[endIndex]?.trim();
      // Stop if we hit an empty line or what looks like user content (not starting with / or .)
      if (line === '') {
        endIndex++;
        break;
      }
      // Continue if it looks like a generated file path
      if (line?.startsWith('/') || line?.startsWith('.') || line?.includes('.md') || line?.includes('.json')) {
        endIndex++;
      } else {
        break;
      }
    }

    // Remove the section
    lines.splice(markerIndex, endIndex - markerIndex);

    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
      lines.pop();
    }

    return lines.join('\n');
  }
}