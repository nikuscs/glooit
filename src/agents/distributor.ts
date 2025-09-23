import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import type { Agent, Rule, Config, SyncContext } from '../types';
import { getAgentPath, getAgentDirectory } from './index';
import { AgentWriterFactory } from './writers';
import { replaceStructure } from '../hooks/project-structure';
import { replaceEnv } from '../hooks/env-variables';
import { addTimestamp } from '../hooks/timestamp';

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

    const agentDir = getAgentDirectory(agent);
    if (agentDir) {
      const fullDir = join(rule.to, agentDir);
      mkdirSync(fullDir, { recursive: true });
    } else {
      mkdirSync(dirname(targetPath), { recursive: true });
    }

    const writer = AgentWriterFactory.createWriter(agent);
    const formattedContent = writer.formatContent(content, rule);

    const context: SyncContext = {
      config: this.config,
      rule,
      content: formattedContent,
      targetPath,
      agent
    };

    const finalContent = await this.applyHooks(context);

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