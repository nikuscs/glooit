# glooit 🧴

> Sync your AI agent configurations and rules across platforms with ease

**glooit** keeps your AI agent rules and MCP configurations in perfect sync across Claude Code, Cursor, Roo Code, and other AI development tools.

## Quick Start

```bash
# Install 
npm install -g glooit
bun install -g glooit
pnpm install -g glooit

#  Run
npx glooit init
bunx glooit init
pnpx glooit init
```

## Basic Usage

### 1. Initialize Configuration

```bash
glooit init
```

This creates a `glooit.config.ts` file:

```typescript
import { Config } from 'glooit';

export default {
  rules: [
    {
      file: 'main.md',
      to: './',
      targets: ['claude', 'cursor', 'codex']
    }
  ]
} satisfies Config;
```

### 2. Sync Your Rules

```bash
glooit sync
```

This automatically creates:

- `CLAUDE.md` (for Claude Code)
- `.cursor/rules/main.md` (for Cursor)
- `AGENTS.md` (for Codex)

### 3. Add MCP Configurations

```typescript
export default {
  rules: [
    // ... your rules
  ],
  mcps: [
    {
      name: 'postgres',
      config: {
        command: 'npx',
        args: ['pg-mcp-server'],
        env: { DATABASE_URL: 'postgresql://localhost/mydb' }
      },
      targets: ['claude', 'cursor']
    }
  ]
} satisfies Config;
```

## Configuration

### Supported Agents

- **Claude Code**
- **Cursor**
- **Roo Code/Cline**
- **Codex**
- **Generic**

### Full Configuration

```typescript
import { defineRules } from 'glooit';

export default defineRules({
  configDir: '.glooit',
  targets: ['claude', 'cursor'],
  rules: [
    {
      name: 'main',
      file: '.glooit/main.md',
      to: './',
      targets: ['claude', 'cursor']
    }
  ],
  mcps: [],
  mergeMcps: true,
  backup: {
    enabled: true,
    retention: 10
  }
});
```

## Advanced Usage

### Custom File Destinations

```typescript
export default defineRules({
  rules: [
    {
      name: 'backend-rules',
      file: '.glooit/backend.md',
      to: './',
      targets: [
        'claude',
        { name: 'cursor', to: './backend/.cursor/rules/backend.md' },
        { name: 'generic', to: './docs/backend-standards.md' }
      ]
    }
  ]
});
```

### Hooks (Before & After Sync)

```typescript
import { defineRules, hooks } from 'glooit';

export default defineRules({
  rules: [/* your rules */],
  hooks: {
    before: [
      async ({ config }) => {
        console.log('🚀 Starting sync...');
        // Run tests, validate env, etc.
      }
    ],
    after: [
      async (context) => {
        console.log('✅ Sync complete!');
        // Commit changes, notify team, etc.
        return `Synced ${context.rule.name} successfully`;
      },
      hooks.addTimestamp,
      hooks.replaceEnv
    ]
  }
});
```

### Built-in Hooks

glooit comes with handy hooks to supercharge your sync process:

```typescript
import { defineRules, hooks } from 'glooit';

export default defineRules({
  rules: [/* your rules */],
  hooks: {
    after: [
      hooks.addTimestamp,
      hooks.replaceEnv,
      hooks.replaceStructure,
      hooks.compact()
    ]
  }
});
```

**🕒 `addTimestamp`** - Replace `__TIMESTAMP__` with current date/time

```markdown
Last updated: __TIMESTAMP__
<!-- Becomes: Last updated: December 24, 2024, 03:30 PM -->
```

**🌍 `replaceEnv`** - Replace `__ENV_VAR__` patterns with environment variables

```markdown
Database: __ENV_DATABASE_URL__
API Key: __ENV_API_KEY__
<!-- Uses your actual env vars -->
```

**📁 `replaceStructure`** - Replace `__STRUCTURE__` with project tree

```markdown
Project structure:
__STRUCTURE__
<!-- Becomes a nice ASCII tree of your project -->
```

**🗜️ `compact`** - Clean up and compress your markdown

```typescript
hooks.compact({
  maxConsecutiveNewlines: 2,
  removeFillerWords: true,    // Removes "basically", "literally", etc.
  compactLists: true         // Tightens up list spacing
})
```

### MCP Configuration

```typescript
export default defineRules({
  rules: [/* your rules */],
  mcps: [
    {
      name: 'filesystem',
      config: {
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', process.cwd()]
      },
      targets: ['claude']
    },
    {
      name: 'postgres',
      config: {
        command: 'uvx',
        args: ['mcp-server-postgres'],
        env: { DATABASE_URL: process.env.DATABASE_URL }
      },
      targets: ['claude', 'cursor']
    }
  ]
});
```

### Monorepos & AGENTS.md

When using `AGENTS.md` in subdirectories, Cursor automatically detects them - no need to enable Cursor for those specific paths. Perfect for monorepos where different services need different rules.

### File Formats by Project Type

**JavaScript/TypeScript projects:**

```typescript
// glooit.config.ts - with TypeScript support
export default defineRules({ /* config */ });
```

**Non-JS projects:**

```javascript
// glooit.config.js - plain JavaScript / typescript
export default { /* config */ };
```

## Commands

```bash
glooit init          # Initialize configuration
glooit sync          # Sync rules and MCPs
glooit validate      # Validate configuration
glooit clean         # Remove generated files
glooit reset --force # Complete reset
glooit backup list   # List backups
```

## Features

- 🔄 **Multi-platform sync** - Works with all major AI coding assistants
- 📦 **MCP support** - Model Context Protocol configuration management
- 🎯 **Selective targeting** - Choose which agents get which rules and wht folders, perfect for complex projects & monorepos
- 🔙 **Backup system** - Automatic backups before changes
- 🧹 **Clean management** - Easy cleanup and reset options
- 📝 **Auto .gitignore** - Automatically manages generated files in .gitignore
- ⚡ **Fast** - Built with Bun for.... you know... bun?

## License

MIT

## Credits

Without these amazing projects, this project would not be possible.

- [Antfu](https://antfu.me) for the amazing packages
- [Ruler](https://github.com/intellectronica/ruler) Inspiration for the project & ideias
- [Claude](https://www.anthropic.com/home/claude) for the amazing AI that made this project possible in a few hours.
