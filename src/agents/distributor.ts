import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, rmSync, symlinkSync, existsSync } from 'fs';
import { join, dirname, basename, relative, resolve, parse } from 'path';
import type { Agent, AgentName, Rule, Config, SyncContext } from '../types';
import { getAgentPath, getAgentDirectoryPath, isKnownDirectoryType } from './index';
import { AgentWriterFactory } from './writers';
import { replaceStructure } from '../hooks/project-structure';
import { replaceEnv } from '../hooks/env-variables';
import { addTimestamp } from '../hooks/timestamp';
import { validateSymlinkPath } from '../core/utils';

export class AgentDistributor {
  private warnedRules = new Set<string>();

  constructor(private config: Config, private symlinkPaths: Set<string> = new Set()) {}

  async distributeRule(rule: Rule): Promise<void> {
    const filePath = Array.isArray(rule.file) ? rule.file : [rule.file];
    const mode = this.getRuleMode(rule);

    // Check if this is a directory rule (single path that's a directory)
    const firstPath = filePath[0];
    if (filePath.length === 1 && firstPath && this.isDirectory(firstPath)) {
      await this.distributeDirectory(rule, firstPath, mode);
      return;
    }

    if (mode === 'symlink') {
      if (Array.isArray(rule.file)) {
        /* istanbul ignore next -- warning-only fallback */
        this.warn(`Rule "${rule.name ?? firstPath}" uses merge but symlink mode cannot merge. Falling back to copy.`);
      } else {
        this.warnIfSymlinkIncompatible(rule);
        for (const agent of rule.targets) {
          await this.symlinkToAgent(agent, rule, rule.file);
        }
        return;
      }
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

  private async distributeDirectory(rule: Rule, sourceDirPath: string, mode: 'copy' | 'symlink'): Promise<void> {
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

      if (mode === 'symlink') {
        this.warnIfSymlinkIncompatible(rule);
        await this.symlinkDirectoryToAgent(sourceDirPath, targetDir);
      } else {
        await this.copyDirectoryToAgent(sourceDirPath, targetDir, agentName, rule);
      }
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
        // For directory sync (agents/skills/commands), keep original content with frontmatter
        // No writer formatting - these aren't "rules" that need Cursor's globs frontmatter
        const fileRule = { ...rule, file: filePath };

        const context: SyncContext = {
          config: this.config,
          rule: fileRule,
          content,
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

  private async symlinkDirectoryToAgent(sourceDir: string, targetDir: string): Promise<void> {
    const files = this.walkDirectory(sourceDir);

    for (const filePath of files) {
      const relativePath = relative(sourceDir, filePath);
      const targetPath = join(targetDir, relativePath);
      try {
        this.createSymlink(filePath, targetPath, false);
      } catch (error) {
        throw new Error(
          `Failed to symlink directory "${sourceDir}" to "${targetDir}":\n` +
          `  File: ${filePath}\n` +
          `  Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
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

  private async symlinkToAgent(agent: Agent, rule: Rule, sourcePath: string): Promise<void> {
    const customPath = this.getCustomPath(agent);
    let targetPath: string;

    if (customPath) {
      targetPath = customPath;
    } else {
      const ruleName = this.extractRuleName(sourcePath);
      const agentPath = getAgentPath(this.getAgentName(agent), ruleName);
      targetPath = join(rule.to, agentPath);
    }

    try {
      this.createSymlink(sourcePath, targetPath, false);
    } catch (error) {
      const agentName = this.getAgentName(agent);
      throw new Error(
        `Failed to create symlink for agent "${agentName}":\n` +
        `  Source: ${sourcePath}\n` +
        `  Target: ${targetPath}\n` +
        `  Error: ${error instanceof Error ? error.message : String(error)}\n\n` +
        `This might be due to:\n` +
        `  - Insufficient filesystem permissions\n` +
        `  - Filesystem doesn't support symlinks (some Windows configurations)\n` +
        `  - Invalid file paths\n\n` +
        `Consider using mode: 'copy' instead of 'symlink' if this persists.`
      );
    }
  }

  private loadRuleContent(filePaths: string[]): string {
    try {
      if (filePaths.length === 1 && filePaths[0]) {
        // Single file - read normally
        return readFileSync(filePaths[0], 'utf-8');
      }

      // Multiple files - merge with separators (no source markers)
      const mergedContent: string[] = [];

      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        if (!filePath) continue;
        let content = readFileSync(filePath, 'utf-8');

        // Strip YAML frontmatter when merging (it's agent-specific metadata)
        content = this.stripFrontmatter(content);

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

  /**
   * Strips YAML frontmatter from markdown content.
   * Frontmatter is the block between --- delimiters at the start of a file.
   */
  private stripFrontmatter(content: string): string {
    const frontmatterRegex = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
    return content.replace(frontmatterRegex, '').trimStart();
  }

  private extractRuleName(filePath: string): string {
    return basename(filePath, '.md');
  }

  private getRuleMode(rule: Rule): 'copy' | 'symlink' {
    return rule.mode ?? this.config.mode ?? 'copy';
  }

  private warnIfSymlinkIncompatible(rule: Rule): void {
    const ruleName = rule.name ?? 'unnamed';

    // Only warn once per rule to avoid spam
    if (this.warnedRules.has(ruleName)) {
      /* istanbul ignore next -- deduplication path tested but coverage tool may miss it */
      return;
    }
    this.warnedRules.add(ruleName);

    const limitations: string[] = [];

    if (rule.hooks && rule.hooks.length > 0) {
      limitations.push('• Per-rule hooks will not run');
    }
    if (this.config.transforms?.after && this.config.transforms.after.length > 0) {
      limitations.push('• Global transforms.after will not run');
    }
    if (this.config.transforms?.before && this.config.transforms.before.length > 0) {
      limitations.push('• Global transforms.before will not affect output');
    }
    limitations.push('• Agent-specific formatting will be skipped');

    if (limitations.length > 0) {
      this.warn(
        `Symlink mode limitations for rule "${ruleName}":\n` +
        limitations.join('\n') +
        '\n(Symlinks point directly to source files, so transformations cannot be applied)'
      );
    }
  }

  private warn(message: string): void {
    console.warn(`⚠️  ${message}`);
  }

  private createSymlink(sourcePath: string, targetPath: string, isDir: boolean): void {
    // Validate source path exists
    if (!existsSync(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    // Validate path security (prevent path traversal)
    validateSymlinkPath(sourcePath);

    // Handle existing target
    if (existsSync(targetPath)) {
      this.warn(`Target already exists and will be replaced: ${targetPath}`);
      rmSync(targetPath, { recursive: true, force: true });
    }

    // Ensure target directory exists
    mkdirSync(dirname(targetPath), { recursive: true });

    // Resolve paths for symlink creation
    const resolvedSource = resolve(sourcePath);
    const resolvedTarget = resolve(targetPath);
    const targetDir = dirname(resolvedTarget);
    const sourceRoot = parse(resolvedSource).root;
    const targetRoot = parse(resolvedTarget).root;
    /* istanbul ignore next -- platform/drive-specific path resolution */
    const relativeTarget = sourceRoot === targetRoot ? relative(targetDir, resolvedSource) : resolvedSource;

    /* istanbul ignore next -- platform-specific symlink type */
    const type = process.platform === 'win32'
      ? (isDir ? 'junction' : 'file')
      : undefined;

    try {
      symlinkSync(relativeTarget, targetPath, type);
      this.symlinkPaths.add(targetPath);
    } catch (error) {
      /* istanbul ignore next -- filesystem-specific symlink errors are difficult to test portably */
      throw new Error(
        `Failed to create symlink: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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
        /* istanbul ignore next -- defensive transform type check */
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
