# glooit 🧴

Sync AI coding assistant configurations across Claude Code, Cursor, Codex, and Roo Code.

- **Rules** - Agent instructions and guidelines
- **Commands** - Custom slash commands
- **Skills** - Reusable agent capabilities
- **Agents** - Custom agent definitions
- **MCP Servers** - Model Context Protocol configurations

## Why glooit?

Teams today use different AI coding assistants - some prefer Claude Code, others use Cursor, and CI/CD might run on Codex. Each tool has its own config format and location:

- Claude Code reads `CLAUDE.md`
- Cursor uses `.cursor/rules/*.mdc` with frontmatter
- Codex expects `AGENTS.md`
- Roo Code looks in `.roo/rules/`

**glooit** lets you write your rules once and sync them everywhere. Perfect for:

- **Multi-agent teams** - Everyone uses their preferred AI assistant with consistent rules
- **Monorepos** - Different rules for different packages, all managed centrally
- **CI/CD pipelines** - Same rules in development and automation
- **Evolving tooling** - Switch or add AI assistants without rewriting configs

## Install

```bash
# npm
npm install -g glooit
npx glooit init

# bun
bun install -g glooit
bunx glooit init

# pnpm
pnpm install -g glooit
pnpx glooit init
```

## Quick Start

```bash
glooit init              # Create config
glooit sync              # Sync rules to all agents
```

## Configuration

Create `.glooit/main.md` with your rules, then configure `glooit.config.ts`:

```typescript
import { defineRules } from 'glooit';

export default defineRules({
  rules: [
    {
      file: '.glooit/main.md',
      to: './',
      targets: ['claude', 'cursor', 'codex']
    }
  ]
});
```

Run `glooit sync` (or `bunx glooit sync` / `npx glooit sync`) and it creates:

- `CLAUDE.md` for Claude Code
- `.cursor/rules/main.mdc` for Cursor
- `AGENTS.md` for Codex

## Supported Agents

| Agent | Output Path | Format |
|-------|-------------|--------|
| `claude` | `CLAUDE.md` | Markdown |
| `cursor` | `.cursor/rules/{name}.mdc` | Frontmatter |
| `codex` | `AGENTS.md` | Markdown |
| `roocode` | `.roo/rules/{name}.md` | Markdown |
| `generic` | `{name}.md` | Markdown |

## Features

### Custom Paths

Override output locations per-agent:

```typescript
{
  file: '.glooit/backend.md',
  to: './',
  targets: [
    'claude',
    { name: 'cursor', to: './backend/.cursor/rules/api.mdc' }
  ]
}
```

### Directory Sync

Copy entire directories for commands, skills, or agents:

```typescript
{
  name: 'commands',
  file: '.glooit/commands',    // Directory path
  targets: ['claude', 'cursor']
  // Auto-maps to .claude/commands and .cursor/commands
}
```

Supported directory types: `commands`, `skills`, `agents`

### File Merging

Combine multiple files into one output:

```typescript
{
  file: [
    '.glooit/coding-standards.md',
    '.glooit/testing-guidelines.md'
  ],
  to: './',
  targets: [
    { name: 'claude', to: './GUIDELINES.md' }
  ]
}
```

### Globs (Cursor)

Limit rule scope to specific files:

```typescript
{
  file: '.glooit/frontend.md',
  to: './apps/frontend',
  globs: 'src/**/*.{ts,tsx}',
  targets: ['cursor']
}
```

### Hooks & Replacements

Transform content during sync using placeholders in your source files.

**Source file** (`.glooit/main.md`):

```markdown
# Project Guidelines

Last updated: __TIMESTAMP__

## Project Structure

__STRUCTURE__

## Environment

- Node version: __NODE_VERSION__
- API URL: __API_URL__
```

**Config** (`glooit.config.ts`):

```typescript
import { defineRules, hooks } from 'glooit';

export default defineRules({
  rules: [
    {
      file: '.glooit/main.md',
      to: './',
      targets: ['claude'],
      hooks: ['replaceStructure', 'addTimestamp', 'replaceEnv']
    }
  ],
  hooks: {
    after: [hooks.compact({ removeFillerWords: true })]
  }
});
```

**Built-in hooks:**

| Hook | Placeholder | Description |
|------|-------------|-------------|
| `addTimestamp` | `__TIMESTAMP__` | Replaced with current date/time |
| `replaceEnv` | `__ENV_VAR__` | Replaced with `process.env.ENV_VAR` value |
| `replaceStructure` | `__STRUCTURE__` | Replaced with project directory tree |
| `compact` | - | Cleans up markdown (removes filler words, extra newlines) |

**Usage:**

- Per-rule hooks: Add `hooks: ['hookName']` to individual rules
- Global hooks: Add to `hooks.after` array to run on all rules

### MCP Configuration

Configure Model Context Protocol servers:

```typescript
export default defineRules({
  rules: [...],
  mcps: [
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

### Backup

Automatic backups before sync:

```typescript
export default defineRules({
  rules: [...],
  backup: {
    enabled: true,
    retention: 10
  }
});
```

## Commands

```bash
glooit init              # Initialize configuration
glooit sync              # Sync rules and MCPs
glooit validate          # Validate configuration
glooit clean             # Clean .gitignore entries
glooit reset --force     # Remove all generated files
glooit backup list       # List available backups
glooit backup restore <timestamp>  # Restore from backup
```

All commands work with `npx`, `bunx`, or `pnpx`:

```bash
npx glooit sync
bunx glooit sync
pnpx glooit sync
```

## Examples

See [examples/full.config.ts](examples/full.config.ts) for a complete configuration with all features.

## Credits

Without these amazing projects, this project would not be possible.

- [Antfu](https://antfu.me) for the amazing packages
- [Ruler](https://github.com/intellectronica/ruler) Inspiration for the project & ideas
- [Claude](https://claude.ai) for the amazing AI that made this project possible in a few hours.

## License

MIT
