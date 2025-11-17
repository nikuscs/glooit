import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import type { Agent, AgentName, Rule, Config, SyncContext } from '../types';
import { getAgentPath } from './index';
import { AgentWriterFactory } from './writers';
import { replaceStructure } from '../hooks/project-structure';
import { replaceEnv } from '../hooks/env-variables';
import { addTimestamp } from '../hooks/timestamp';

export class AgentDistributor {
  constructor(private config: Config) {}

  async distributeRule(rule: Rule): Promise<void> {
    const filePath = Array.isArray(rule.file) ? rule.file : [rule.file];
    const content = this.loadRuleContent(filePath);

    for (const agent of rule.targets) {
      await this.distributeToAgent(agent, rule, content);
    }
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
      const firstFile = Array.isArray(rule.file) ? rule.file[0]! : rule.file;
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
      if (filePaths.length === 1) {
        // Single file - read normally
        return readFileSync(filePaths[0]!, 'utf-8');
      }

      // Multiple files - merge with separators and markers
      const mergedContent: string[] = [];

      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i]!;
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

    if (this.config.hooks?.after) {
      for (const hook of this.config.hooks.after) {
        const updatedContext = { ...context, content };
        const result = await hook(updatedContext);
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