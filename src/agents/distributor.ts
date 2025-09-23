import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import type { Agent, Rule, Config, SyncContext } from '../types';
import { getAgentPath, getAgentDirectory } from './index';
import { AgentWriterFactory } from './writers';

export class AgentDistributor {
  constructor(private config: Config) {}

  async distributeRule(rule: Rule): Promise<void> {
    const content = this.loadRuleContent(rule.file);

    for (const agent of rule.targets) {
      await this.distributeToAgent(agent, rule, content);
    }
  }

  private async distributeToAgent(agent: Agent, rule: Rule, content: string): Promise<void> {
    const ruleName = this.extractRuleName(rule.file);
    const agentPath = getAgentPath(agent, ruleName);
    const targetPath = join(rule.to, agentPath);

    // Create directory if needed
    const agentDir = getAgentDirectory(agent);
    if (agentDir) {
      const fullDir = join(rule.to, agentDir);
      mkdirSync(fullDir, { recursive: true });
    } else {
      mkdirSync(dirname(targetPath), { recursive: true });
    }

    // Format content based on agent requirements
    const writer = AgentWriterFactory.createWriter(agent);
    const formattedContent = writer.formatContent(content, rule);

    // Apply hooks if configured
    const context: SyncContext = {
      config: this.config,
      rule,
      content: formattedContent,
      targetPath,
      agent
    };

    const finalContent = await this.applyHooks(context);

    // Write the file
    writeFileSync(targetPath, finalContent, 'utf-8');
  }

  private loadRuleContent(filePath: string): string {
    try {
      return readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read rule file ${filePath}: ${error}`);
    }
  }

  private extractRuleName(filePath: string): string {
    return basename(filePath, '.md');
  }


  private async applyHooks(context: SyncContext): Promise<string> {
    let content = context.content;

    // Apply rule-specific hooks
    if (context.rule.hooks) {
      for (const hookName of context.rule.hooks) {
        content = await this.executeHook(hookName, content, { ...context, content });
      }
    }

    // Apply global after hooks
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
    // Import built-in hooks dynamically if needed
    switch (hookName) {
      case 'replaceStructure': {
        const { replaceStructure } = await import('../hooks/project-structure');
        return await replaceStructure(context);
      }
      case 'replaceEnv': {
        const { replaceEnv } = await import('../hooks/env-variables');
        return replaceEnv(context);
      }
      case 'addTimestamp': {
        const { addTimestamp } = await import('../hooks/timestamp');
        return addTimestamp(context);
      }
      default:
        // Custom hooks would be resolved here
        return content;
    }
  }
}