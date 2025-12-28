/**
 * Full glooit configuration example
 * This file demonstrates all available features
 *
 * @see https://github.com/jonschlinkert/glooit
 */
import { defineRules, transforms } from 'glooit';

export default defineRules({
  // ─────────────────────────────────────────────────────────────
  // BASIC CONFIG
  // ─────────────────────────────────────────────────────────────

  // Directory for source rule files (default: '.glooit')
  configDir: '.glooit',

  // ─────────────────────────────────────────────────────────────
  // RULES - Define how rule files are distributed to agents
  // ─────────────────────────────────────────────────────────────

  rules: [
    // Simple rule: single file to multiple agents
    {
      name: 'main',
      file: '.glooit/main.md',
      to: './',
      targets: ['claude', 'cursor', 'codex']
    },

    // Rule with globs: Cursor will only apply to matching files
    {
      name: 'frontend',
      file: '.glooit/frontend.md',
      to: './apps/frontend',
      globs: 'src/**/*.{ts,tsx}',  // Cursor-specific: limits rule scope
      targets: ['claude', 'cursor']
    },

    // Custom paths: override default output locations
    {
      name: 'backend',
      file: '.glooit/backend.md',
      to: './',
      targets: [
        'claude',  // Uses default: CLAUDE.md
        { name: 'cursor', to: './backend/.cursor/rules/api.mdc' },
        { name: 'generic', to: './docs/backend-guidelines.md' }
      ]
    },

    // Per-rule hooks: apply specific transformations
    {
      name: 'project-info',
      file: '.glooit/project.md',
      to: './',
      targets: ['claude'],
      hooks: ['replaceStructure', 'addTimestamp', 'replaceEnv']
    },

    // Merged files: combine multiple source files into one output
    {
      name: 'combined',
      file: [
        '.glooit/coding-standards.md',
        '.glooit/testing-guidelines.md',
        '.glooit/review-checklist.md'
      ],
      to: './',
      targets: [
        { name: 'claude', to: './GUIDELINES.md' },
        { name: 'cursor', to: './.cursor/rules/guidelines.mdc' }
      ]
    },

    // Directory sync: copy entire directories (commands, skills, agents)
    {
      name: 'commands',
      file: '.glooit/commands',  // Directory path
      targets: ['claude', 'cursor']
      // No 'to' needed - auto-maps to .claude/commands and .cursor/commands
    },

    // Directory sync with hooks
    {
      name: 'skills',
      file: '.glooit/skills',
      targets: ['claude'],
      hooks: ['addTimestamp']  // Applied to all .md files in directory
    },

    // Custom directory path for unsupported agents
    {
      name: 'agents',
      file: '.glooit/agents',
      targets: [
        'claude',  // Auto: .claude/agents
        { name: 'codex', to: './custom-agents' }  // Codex doesn't support agents dir
      ]
    },

    // Disable gitignore for specific rule
    {
      name: 'public-docs',
      file: '.glooit/public.md',
      to: './docs',
      targets: ['generic'],
      gitignore: false  // Don't add to .gitignore
    }
  ],

  // ─────────────────────────────────────────────────────────────
  // MCP - Model Context Protocol server configurations
  // ─────────────────────────────────────────────────────────────

  mcps: [
    // Basic MCP server
    {
      name: 'filesystem',
      config: {
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', process.cwd()]
      },
      targets: ['claude']
    },

    // MCP with environment variables
    {
      name: 'postgres',
      config: {
        command: 'uvx',
        args: ['mcp-server-postgres'],
        env: {
          DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost/mydb'
        }
      },
      targets: ['claude', 'cursor']
    },

    // Custom output path
    {
      name: 'custom-server',
      config: {
        command: 'node',
        args: ['./scripts/mcp-server.js']
      },
      outputPath: './custom-mcp.json',
      targets: ['claude']
    }
  ],

  // Merge with existing MCP configs (default: true)
  mergeMcps: true,

  // ─────────────────────────────────────────────────────────────
  // TRANSFORMS - Content transformations during sync
  // ─────────────────────────────────────────────────────────────

  transforms: {
    // Run before sync starts
    before: [
      async ({ config }) => {
        console.log(`Starting sync with ${config.rules.length} rules...`);
      }
    ],

    // Run after each rule is synced (can modify content)
    after: [
      // Built-in transforms
      transforms.addTimestamp,      // Replace __TIMESTAMP__ with current date
      transforms.replaceEnv,        // Replace __ENV_VAR__ with env values
      transforms.replaceStructure,  // Replace __STRUCTURE__ with project tree

      // Compact transform with options
      transforms.compact({
        maxConsecutiveNewlines: 2,
        removeFillerWords: true,
        compactLists: true
      }),

      // Custom transform
      async (context) => {
        console.log(`Synced: ${context.targetPath}`);
        return context.content;  // Return modified content
      }
    ],

    // Run on errors
    error: [
      async (error) => {
        console.error('Sync failed:', error.message);
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // AGENT HOOKS - Lifecycle hooks for Claude Code and Cursor
  // ─────────────────────────────────────────────────────────────

  hooks: [
    // Auto-format files after edits
    {
      event: 'afterFileEdit',
      command: 'npx prettier --write',
      targets: ['claude', 'cursor']
    },

    // Run ESLint after TypeScript file edits
    {
      event: 'PostToolUse',
      script: '.glooit/hooks/lint-ts.ts',
      matcher: 'Edit|Write',
      targets: ['claude']
    },

    // Validate shell commands before execution
    {
      event: 'beforeShellExecution',
      script: '.glooit/hooks/validate-command.ts',
      targets: ['claude', 'cursor']
    }
  ],

  // ─────────────────────────────────────────────────────────────
  // BACKUP - Automatic backup before sync
  // ─────────────────────────────────────────────────────────────

  backup: {
    enabled: true,      // Enable backups (default: true)
    retention: 10       // Keep last 10 backups (default: 10)
  },

  // ─────────────────────────────────────────────────────────────
  // GITIGNORE - Auto-manage .gitignore entries
  // ─────────────────────────────────────────────────────────────

  gitignore: true  // Add generated files to .gitignore (default: true)
});
