# AI Rules

A tool to reconcile AI agent configurations across different platforms (Cursor, Claude Code, Codex, Roo Code/Cline) using a single TypeScript configuration file.

## Features

- **Single Configuration**: Define rules once, distribute to multiple AI platforms
- **Flexible Targeting**: Choose which agents get which rules using `targets`
- **Smart Backup System**: Automatic backups before sync with restore capability
- **GitIgnore Management**: Auto-manages `.gitignore` for generated files
- **Hooks System**: Extensible plugin architecture for custom transformations
- **Type Safe**: Full TypeScript support with Zod validation

## Installation

```bash
npm install ai-rules
# or
bun add ai-rules
# or
yarn add ai-rules
```

## Quick Start

1. **Initialize configuration**:
   ```bash
   npx ai-rules init
   ```

2. **Edit the generated `ai-rules.config.ts`**:
   ```typescript
   import { defineRules, hooks } from 'ai-rules';

   export default defineRules({
     configDir: '.ai-rules',

     rules: [
       {
         file: '.ai-rules/main.md',
         to: './',
         globs: '**/*',
         targets: ['claude', 'cursor', 'codex', 'roocode'],
         hooks: ['replaceStructure', 'replaceEnv']
       },
       {
         file: '.ai-rules/frontend.md',
         to: './apps/frontend',
         globs: 'apps/frontend/**/*',
         targets: ['cursor', 'claude']
       }
     ],

     commands: [
       {
         command: 'cleanup',
         file: '.ai-rules/commands/cleanup.md',
         targets: ['claude', 'cursor']
       }
     ],

     hooks: {
       before: [
         (context) => console.log('Starting sync...')
       ],
       after: [
         hooks.addTimestamp
       ]
     }
   });
   ```

3. **Create your rule files**:
   ```bash
   mkdir -p .ai-rules/commands
   echo "# Main Project Rules" > .ai-rules/main.md
   echo "# Cleanup Command" > .ai-rules/commands/cleanup.md
   ```

4. **Sync to all agents**:
   ```bash
   npx ai-rules sync
   ```

## Agent Output Mapping

| Agent | Output Location | Format |
|-------|----------------|--------|
| **Claude Code** | `CLAUDE.md` | Plain markdown |
| **Cursor** | `.cursor/rules/{name}.md` | Frontmatter + markdown |
| **Codex** | `AGENTS.md` | Plain markdown |
| **Roo Code (Cline)** | `.roo/rules/{name}.md` | Plain markdown |

## Configuration Schema

```typescript
import { defineRules, hooks } from 'ai-rules';

export default defineRules({
  configDir: '.ai-rules',          // Where to store backups and temp files

  rules: [
    {
      file: '.ai-rules/main.md',   // Source rule file
      to: './',                    // Target directory
      globs: '**/*',               // Glob pattern (for Cursor)
      targets: ['claude', 'cursor'], // Which agents to target
      hooks: ['replaceStructure']   // Optional hooks to apply
    }
  ],

  commands: [
    {
      command: 'cleanup',          // Command name
      file: '.ai-rules/commands/cleanup.md',
      targets: ['claude', 'cursor']
    }
  ],

  mcps: [                          // Claude MCP configurations
    {
      name: 'postgres',
      config: {
        command: 'npx',
        args: ['pg-mcp-server'],
        env: { DATABASE_URL: '__ENV_DATABASE_URL__' }
      },
      outputPath: 'claude_desktop_config.json'
    }
  ],

  hooks: {
    before: [                      // Before sync starts
      (context) => console.log('Starting sync')
    ],
    after: [                       // After each rule/command
      hooks.addTimestamp
    ],
    error: [                       // On any error
      (error) => console.error('Sync failed:', error)
    ]
  },

  backup: {
    enabled: true,
    retention: 10                  // Keep last 10 backups
  }
});
```

## CLI Commands

```bash
# Initialize configuration
npx ai-rules init [--force]

# Sync rules to all agents
npx ai-rules sync [--config <path>] [--no-backup]

# Validate configuration
npx ai-rules validate [--config <path>]

# List backups
npx ai-rules backup list

# Restore from backup
npx ai-rules backup restore <timestamp>

# Clean generated files
npx ai-rules clean [--config <path>]
```

## Built-in Hooks

Import and use built-in hooks:

```typescript
import { hooks } from 'ai-rules';

// Available hooks:
hooks.replaceStructure  // Replaces __STRUCTURE__ with project directory tree
hooks.replaceEnv        // Replaces __ENV_VARIABLE_NAME__ with environment variables
hooks.addTimestamp      // Replaces __TIMESTAMP__ with readable date format
hooks.compact          // Compacts markdown by removing excessive whitespace
```

### Compact Hook

The `compact` hook optimizes markdown content by removing excessive whitespace, filler words, and other redundancies while preserving code blocks and frontmatter:

```typescript
import { hooks } from 'ai-rules';

export default defineRules({
  hooks: {
    after: [
      hooks.compact({
        preserveFrontmatter: true,    // Keep Cursor frontmatter intact
        maxConsecutiveNewlines: 2,    // Limit consecutive newlines
        removeFillerWords: false,     // Remove filler words like "basically", "literally"
        trimTrailingSpaces: true,     // Remove trailing whitespace
        compactLists: true           // Remove extra spacing in lists
      })
    ]
  }
});
```

## Example: Using Hooks

```typescript
import { defineRules, hooks } from 'ai-rules';

export default defineRules({
  rules: [
    {
      file: '.ai-rules/main.md',
      to: './',
      targets: ['claude', 'cursor'],
      hooks: ['replaceStructure', 'replaceEnv'] // Built-in hooks
    }
  ],

  hooks: {
    before: [
      (context) => {
        console.log(`Starting sync for ${context.config.rules.length} rules`);
      }
    ],
    after: [
      hooks.addTimestamp,  // Add timestamp to each generated file
      (context) => {
        // Custom hook: add project name to content
        return context.content + `\n\n<!-- Generated for ${process.env.PROJECT_NAME} -->`;
      }
    ]
  }
});
```

## Example: Multi-Project Setup

```typescript
export default defineRules({
  rules: [
    // Global rules for all projects
    {
      file: '.ai-rules/global.md',
      to: './',
      targets: ['claude', 'cursor']
    },

    // Frontend-specific rules
    {
      file: '.ai-rules/frontend.md',
      to: './apps/frontend',
      globs: 'apps/frontend/**/*',
      targets: ['cursor'],
      hooks: ['replaceStructure']
    },

    // Backend-specific rules
    {
      file: '.ai-rules/backend.md',
      to: './apps/backend',
      globs: 'apps/backend/**/*',
      targets: ['claude', 'roocode']
    }
  ]
});
```

## Development

```bash
# Clone and install
git clone <repo>
cd ai-rules
bun install

# Build
bun run build

# Test CLI locally
bun run dev init
```

## License

MIT
