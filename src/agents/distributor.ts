import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import type { Agent, AgentName, Rule, Config, SyncContext } from '../types';
import { getAgentPath, getAgentDirectoryPath, isKnownDirectoryType } from './index';
import { AgentWriterFactory } from './writers';
import { replaceStructure } from '../hooks/project-structure';
import { replaceEnv } from '../hooks/env-variables';
import { addTimestamp } from '../hooks/timestamp';

export class AgentDistributor {
  constructor(private config: Config) {}

  async distributeRule(rule: Rule): Promise<void> {
    const filePath = Array.isArray(rule.file) ? rule.file : [rule.file];

    // Check if this is a directory rule (single path that's a directory)
    const firstPath = filePath[0];
    if (filePath.length === 1 && firstPath && this.isDirectory(firstPath)) {
      await this.distributeDirectory(rule, firstPath);
      return;
    }

    const content = this.loadRuleContent(filePath);

    for (const agent of rule.targets) {
      await this.distributeToAgent(agent, rule, content);
    }
  }

  private isDirectory(path: string): boolean {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  }

  private async distributeDirectory(rule: Rule, sourceDirPath: string): Promise<void> {
    const dirType = rule.name || basename(sourceDirPath);

    for (const agent of rule.targets) {
      const agentName = this.getAgentName(agent);
      const customPath = this.getCustomPath(agent);

      let targetDir: string;

      if (customPath) {
        // User provided custom path
        targetDir = customPath;
      } else if (isKnownDirectoryType(dirType)) {
        // Use known directory mapping
        const mappedPath = getAgentDirectoryPath(agentName, dirType);
        if (!mappedPath) {
          throw new Error(
            `Agent '${agentName}' does not support directory type '${dirType}'. ` +
            `Please provide an explicit 'to' path for this agent.`
          );
        }
        targetDir = join(rule.to, mappedPath);
      } else {
        // Unknown directory type without custom path
        throw new Error(
          `Unknown directory type '${dirType}' for agent '${agentName}'. ` +
          `Please provide an explicit 'to' path or use a known type: commands, skills, agents.`
        );
      }

      await this.copyDirectoryToAgent(sourceDirPath, targetDir, agentName, rule);
    }
  }

  private async copyDirectoryToAgent(
    sourceDir: string,
    targetDir: string,
    agentName: AgentName,
    rule: Rule
  ): Promise<void> {
    const files = this.walkDirectory(sourceDir);

    for (const filePath of files) {
      const relativePath = relative(sourceDir, filePath);
      const targetPath = join(targetDir, relativePath);

      // Read file content
      const content = readFileSync(filePath, 'utf-8');

      // Create directory structure
      mkdirSync(dirname(targetPath), { recursive: true });

      // Only apply hooks to markdown files
      if (filePath.endsWith('.md')) {
        const writer = AgentWriterFactory.createWriter(agentName);
        const formattedContent = writer.formatContent(content, rule);

        const context: SyncContext = {
          config: this.config,
          rule,
          content: formattedContent,
          targetPath,
          agent: agentName
        };

        const finalContent = await this.applyHooks(context);
        writeFileSync(targetPath, finalContent, 'utf-8');
      } else {
        // Non-markdown files: copy as-is
        writeFileSync(targetPath, content, 'utf-8');
      }
    }
  }

  private walkDirectory(dir: string): string[] {
    const files: string[] = [];
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.walkDirectory(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  private getAgentName(agent: Agent): AgentName {
    return typeof agent === 'string' ? agent : agent.name;
  }

  private getCustomPath(agent: Agent): string | undefined {
    return typeof agent === 'object' ? agent.to : undefined;
  }

  private async distributeToAgent(agent: Agent, rule: Rule, content: string): Promise<void> {
    const agentName = this.getAgentName(agent);
    const customPath = this.getCustomPath(agent);

    let targetPath: string;

    if (customPath) {
      // User provided custom path - use it as-is
      targetPath = customPath;
    } else {
      // Use default path for the agent
      const firstFile = Array.isArray(rule.file) ? rule.file[0] ?? '' : rule.file;
      const ruleName = this.extractRuleName(firstFile);
      const agentPath = getAgentPath(agentName, ruleName);
      targetPath = join(rule.to, agentPath);
    }
    
    mkdirSync(dirname(targetPath), { recursive: true });

    const writer = AgentWriterFactory.createWriter(agentName);
    const formattedContent = writer.formatContent(content, rule);

    const context: SyncContext = {
      config: this.config,
      rule,
      content: formattedContent,
      targetPath,
      agent: agentName
    };

    const finalContent = await this.applyHooks(context);

    writeFileSync(targetPath, finalContent, 'utf-8');
  }

  private loadRuleContent(filePaths: string[]): string {
    try {
      if (filePaths.length === 1 && filePaths[0]) {
        // Single file - read normally
        return readFileSync(filePaths[0], 'utf-8');
      }

      // Multiple files - merge with separators and markers
      const mergedContent: string[] = [];

      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        if (!filePath) continue;
        const content = readFileSync(filePath, 'utf-8');

        // Add marker comment showing source file
        mergedContent.push(`<!-- Source: ${filePath} -->`);
        mergedContent.push(content);

        // Add separator between files (but not after the last one)
        if (i < filePaths.length - 1) {
          mergedContent.push('\n---\n');
        }
      }

      return mergedContent.join('\n');
    } catch (error) {
      throw new Error(`Failed to read rule file(s): ${error}`);
    }
  }

  private extractRuleName(filePath: string): string {
    return basename(filePath, '.md');
  }


  private async applyHooks(context: SyncContext): Promise<string> {
    let content = context.content;

    if (context.rule.hooks) {
      for (const hookName of context.rule.hooks) {
        content = await this.executeHook(hookName, content, { ...context, content });
      }
    }

    if (this.config.transforms?.after) {
      for (const transform of this.config.transforms.after) {
        const updatedContext = { ...context, content };
        const result = await transform(updatedContext);
        if (typeof result === 'string') {
          content = result;
        }
      }
    }

    return content;
  }

  private async executeHook(hookName: string, content: string, context: SyncContext): Promise<string> {
    switch (hookName) {
      case 'replaceStructure': {
        return await replaceStructure(context);
      }
      case 'replaceEnv': {
        return replaceEnv(context);
      }
      case 'addTimestamp': {
        return addTimestamp(context);
      }
      default:
        return content;
    }
  }
}