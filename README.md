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
import { Config } from 'glooit';

export default {
  configDir: '.glooit',
  rules: [
    {
      file: 'coding-standards.md',
      to: './',
      targets: ['claude', 'cursor', 'roocode']
    }
  ],
  mcps: [
    {
      name: 'database',
      config: {
        command: 'npx',
        args: ['db-mcp-server']
      },
      targets: ['claude']
    }
  ],
  mergeMcps: true
} satisfies Config;
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
- ⚡ **Fast** - Built with Bun for.... you know... bun?

## License

MIT
