# glooit 🧴

Sync AI coding assistant configurations across Claude Code, Cursor, Codex, OpenCode, and Roo Code/Cline.

- **Rules** - Agent instructions and guidelines
- **Commands** - Custom slash commands
- **Skills** - Reusable agent capabilities
- **Agents** - Custom agent definitions
- **MCP Servers** - Model Context Protocol configurations
- **Agent Hooks** - Lifecycle hooks for Claude Code and Cursor

## Why glooit?

Teams today use different AI coding assistants - some prefer Claude Code, others use Cursor, OpenCode, and CI/CD might run on Codex. Each tool has its own config format and location:

- Claude Code reads `CLAUDE.md`, commands in `.claude/commands/`, skills in `.claude/skills/`
- Cursor uses `.cursor/rules/*.mdc` with frontmatter, commands in `.cursor/commands/`
- OpenCode expects `AGENTS.md`, commands in `.opencode/command/`, agents in `.opencode/agent/`
- Codex expects `AGENTS.md`
- Roo Code/Cline looks in `.roo/rules/`

**glooit** lets you write your rules once and sync them everywhere. Perfect for:

- **Multi-agent teams** - Everyone uses their preferred AI assistant with consistent rules
- **Monorepos** - Different rules for different packages, all managed centrally
- **CI/CD pipelines** - Same rules in development and automation
- **Evolving tooling** - Switch or add AI assistants without rewriting configs

## Install

```bash
# Homebrew (macOS/Linux)
brew tap nikuscs/glooit https://github.com/nikuscs/glooit
brew install glooit

# npm
npm install -g glooit

# bun
bun install -g glooit

# pnpm
pnpm install -g glooit
```

## Quick Start

```bash
glooit init              # Create config
glooit sync              # Sync rules to all agents
```

## Configuration

Create `.agents/main.md` with your rules, then configure `glooit.config.ts`:

> Legacy support: `.glooit` is still supported. If `configDir` is not set, glooit will use `.agents` when present, otherwise it falls back to `.glooit`.

```typescript
import { defineRules } from 'glooit';

export default defineRules({
  rules: [
    {
      file: '.agents/main.md',
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
| `opencode` | `AGENTS.md` | Markdown |
| `factory` | `AGENTS.md` | Markdown |
| `roocode` | `.roo/rules/{name}.md` | Markdown |
| `generic` | `{name}.md` | Markdown |

### Feature Support Matrix

| Feature     | Claude | Cursor | OpenCode | Codex | Factory | Roo Code/Cline | Generic |
|-------------|--------|--------|----------|-------|---------|----------------|---------|
| Rules       | ✓      | ✓      | ✓        | ✓     | ✓       | ✓              | ✓       |
| Commands    | ✓      | ✓      | ✓        | ✓*    | -       | -              | -       |
| Skills      | ✓      | ✓      | ✓**      | ✓     | ✓       | -              | -       |
| Agents      | ✓      | ✓      | ✓        | -     | ✓***    | -              | -       |
| MCP Servers | ✓      | ✓      | ✓        | ✓     | ✓       | ✓              | ✓       |
| Hooks       | ✓      | ✓      | -        | -     | ✓       | -              | -       |

*Codex uses `.codex/prompts` for commands
**OpenCode uses Claude-compatible skills path (`.claude/skills/`)
***Factory uses "droids" (`.factory/droids/`) for agents

## Features

### Custom Paths

Override output locations per-agent:

```typescript
{
  file: '.agents/backend.md',
  to: './',
  targets: [
    'claude',
    { name: 'cursor', to: './backend/.cursor/rules/api.mdc' }
  ]
}
```

### Directory Sync

Sync commands, skills, and agents directories at the top level:

```typescript
export default defineRules({
  rules: [...],

  // Simple string path (defaults to claude, cursor, opencode)
  commands: '.agents/commands',

  // Or with explicit targets
  skills: {
    path: '.agents/skills',
    targets: ['claude']
  },

  agents: {
    path: '.agents/agents',
    targets: ['claude', 'cursor']
  }
});
```

Output mappings:

- `commands` → `.claude/commands`, `.cursor/commands`, `.opencode/command`, `.codex/prompts`
- `skills` → `.claude/skills`, `.cursor/skills`, `.codex/skills`, `.factory/skills` (OpenCode uses `.claude/skills`)
- `agents` → `.claude/agents`, `.cursor/agents`, `.opencode/agent`, `.factory/droids`

### Symlink Mode

Use symlinks instead of copying. This keeps your source of truth in `.agents` and updates targets instantly.

```typescript
export default defineRules({
  mode: 'symlink', // or 'copy'
  rules: [
    {
      file: '.agents/main.md',
      to: './',
      targets: ['claude', 'cursor']
    },
    {
      file: '.agents/codex.md',
      to: './',
      mode: 'copy', // per-rule override
      targets: ['codex']
    }
  ]
});
```

**Why use symlink mode?**

- Changes to source files instantly reflect in all agent configs (no need to run `glooit sync`)
- Single source of truth - edit once, all agents see the update
- Useful for rapid iteration and development

**Limitations:**
Symlinks point directly to source files, so transformations cannot be applied:

- Per-rule hooks and global transforms are skipped (hooks/transforms would modify the source file)
- Merge rules (`file: string[]`) automatically fall back to copy mode (cannot symlink to multiple files)
- Agent-specific formatting is not applied (each agent would need a different version)

When limitations apply, glooit shows a warning and provides guidance. Use `glooit unlink` to convert symlinks back to regular files.

### File Merging

Combine multiple files into one output:

```typescript
{
  file: [
    '.agents/coding-standards.md',
    '.agents/testing-guidelines.md'
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
  file: '.agents/frontend.md',
  to: './apps/frontend',
  globs: 'src/**/*.{ts,tsx}',
  targets: ['cursor']
}
```

### Transforms

Transform content during sync using placeholders in your source files.

**Source file** (`.agents/main.md`):

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
import { defineRules, transforms } from 'glooit';

export default defineRules({
  rules: [
    {
      file: '.agents/main.md',
      to: './',
      targets: ['claude'],
      hooks: ['replaceStructure', 'addTimestamp', 'replaceEnv']
    }
  ],
  transforms: {
    after: [transforms.compact({ removeFillerWords: true })]
  }
});
```

**Built-in transforms:**

| Transform | Placeholder | Description |
|-----------|-------------|-------------|
| `addTimestamp` | `__TIMESTAMP__` | Replaced with current date/time |
| `replaceEnv` | `__ENV_VAR__` | Replaced with `process.env.ENV_VAR` value |
| `replaceStructure` | `__STRUCTURE__` | Replaced with project directory tree |
| `compact` | - | Cleans up markdown (removes filler words, extra newlines) |

**Usage:**

- Per-rule transforms: Add `hooks: ['transformName']` to individual rules
- Global transforms: Add to `transforms.after` array to run on all rules

### Agent Hooks

Configure lifecycle hooks that run inside Claude Code and Cursor when the AI uses tools.

```typescript
export default defineRules({
  rules: [...],
  hooks: [
    // Run prettier after file edits
    {
      event: 'afterFileEdit',
      command: 'npx prettier --write',
      targets: ['claude', 'cursor']
    },

    // Run a TypeScript script before shell commands
    {
      event: 'beforeShellExecution',
      script: '.agents/hooks/check-command.ts',
      targets: ['claude']
    },

    // Block writes to sensitive files
    {
      event: 'PreToolUse',
      script: '.agents/hooks/block-env-writes.ts',
      matcher: 'Edit|Write',  // Claude Code matcher
      targets: ['claude']
    }
  ]
});
```

**Supported events:**

| Event | Claude Code | Cursor | Description |
|-------|-------------|--------|-------------|
| `PreToolUse` | ✓ | - | Before tool execution (can block) |
| `PostToolUse` | ✓ | - | After tool completion |
| `beforeShellExecution` | ✓ | ✓ | Before shell commands |
| `afterFileEdit` | ✓ | ✓ | After file modifications |
| `Stop` | ✓ | ✓ | When agent finishes |

**Script types:**

- `.ts` files: Run with `bun run`
- `.js` files: Run with `node`
- `.sh` files: Run directly

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
glooit link              # Zero-config symlink sync (no config file needed)
glooit unlink            # Replace symlinked outputs with real files
glooit validate          # Validate configuration
glooit clean             # Clean .gitignore entries
glooit reset --force     # Remove all generated files
glooit upgrade           # Upgrade glooit to latest version
glooit backup list       # List available backups
glooit backup restore <timestamp>  # Restore from backup
```

### Link Command

The `link` command provides zero-config symlink-based syncing without requiring a config file:

```bash
glooit link              # Auto-detect .agents/ or .glooit/ and sync to all agents
glooit link .my-rules    # Use custom source directory
glooit link -t claude,cursor  # Sync to specific agents only
```

It automatically discovers and symlinks:

- `CLAUDE.md` → Claude Code
- `AGENTS.md` → Codex, OpenCode, Factory
- `commands/` → All agents that support commands
- `skills/` → All agents that support skills
- `agents/` → All agents that support agents/droids

### Upgrade

The `upgrade` command auto-detects your package manager and whether glooit is installed locally or globally:

```bash
glooit upgrade           # Auto-detect and upgrade
glooit upgrade -g        # Force global upgrade
glooit upgrade -l        # Force local upgrade
```

All commands work with `npx`, `bunx`, or `pnpx`:

```bash
npx glooit sync
bunx glooit sync
pnpx glooit sync
```

## Examples

See [examples/full.config.ts](examples/full.config.ts) for a complete configuration with all features.

## Development

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Type check and lint
bun run check

# Build
bun run build

# Build local binary
bun run install:local
```

### Releasing

```bash
bun run release
```

This runs checks, prompts for version bump, creates a git tag, and pushes. CI handles npm publish and GitHub release automatically.

## Credits

Without these amazing projects, this project would not be possible.

- [Antfu](https://antfu.me) for the amazing packages
- [Ruler](https://github.com/intellectronica/ruler) Inspiration for the project & ideas
- [Claude](https://claude.ai) for the amazing AI that made this project possible in a few hours.

## License

MIT
