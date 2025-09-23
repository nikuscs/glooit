import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { Agent, Rule, Config, SyncContext } from '../types';
import { AGENT_MAPPINGS, getAgentPath, getAgentDirectory } from './index';

export class AgentDistributor {
  constructor(private config: Config) {}

  async distributeRule(rule: Rule): Promise<void> {
    const content = this.loadRuleContent(rule.file);
    const agents = rule.agents || this.config.agents;

    for (const agent of agents) {
      await this.distributeToAgent(agent, rule, content);
    }
  }

  private async distributeToAgent(agent: Agent, rule: Rule, content: string): Promise<void> {
    const mapping = AGENT_MAPPINGS[agent];
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
    const formattedContent = this.formatContent(agent, content, rule);

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

  private formatContent(agent: Agent, content: string, rule: Rule): string {
    const mapping = AGENT_MAPPINGS[agent];

    if (mapping.format === 'frontmatter') {
      return this.addFrontmatter(content, rule);
    }

    return content;
  }

  private addFrontmatter(content: string, rule: Rule): string {
    const frontmatter = [
      '---',
      `description: AI Rules - ${this.extractRuleName(rule.file)}`,
      `globs: ${rule.globs || '**/*'}`,
      'alwaysApply: true',
      '---',
      ''
    ].join('\n');

    return frontmatter + content;
  }

  private async applyHooks(context: SyncContext): Promise<string> {
    let content = context.content;

    // Apply rule-specific hooks
    if (context.rule.hooks) {
      for (const hookName of context.rule.hooks) {
        content = await this.executeHook(hookName, content, context);
      }
    }

    // Apply global afterRule hooks
    if (this.config.hooks?.afterRule) {
      for (const hook of this.config.hooks.afterRule) {
        const result = await hook(context);
        if (typeof result === 'string') {
          content = result;
        }
      }
    }

    return content;
  }

  private async executeHook(hookName: string, content: string, context: SyncContext): Promise<string> {
    // Built-in hooks
    switch (hookName) {
      case 'replaceStructure':
        return content.replace('__STRUCTURE__', await this.getProjectStructure());
      default:
        // Custom hooks would be resolved here
        return content;
    }
  }

  private async getProjectStructure(): Promise<string> {
    // Simple implementation - could be enhanced
    return '```\nProject structure placeholder\n```';
  }
}