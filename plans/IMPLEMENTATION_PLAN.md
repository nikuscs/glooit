# AI Rules - Implementation Plan

## Overview

A tool to reconcile AI rules across different agents/platforms (Cursor, Claude, Codex, Roo Code) using a single TypeScript configuration file.

## Core Architecture

```
ai-rules/
├── src/
│   ├── types/           # TypeScript definitions
│   ├── agents/          # Agent-specific distributors
│   ├── core/           # Config loader, backup, gitignore
│   ├── hooks/          # Plugin system
│   ├── cli/            # Commander CLI
│   └── index.ts        # Main exports
├── templates/          # Default templates
├── tests/
└── package.json
```

## Key Features

### 1. Flexible Configuration

- Support `ai-rules.config.ts`, `config/ai-rules.ts`, or custom paths
- Type-safe configuration with Zod validation
- Environment variable interpolation

### 2. Agent Distribution System

```typescript
const agentMappings = {
  'claude': { path: 'CLAUDE.md', format: 'markdown' },
  'cursor': { path: '.cursor/rules/{name}.md', format: 'frontmatter' },
  'codex': { path: 'AGENTS.md', format: 'markdown' },
  'roocode': { path: '.roo/rules/{name}.md', format: 'markdown' }
}
```

### 3. Smart Backup System

- Timestamp-based backups in `.ai-rules/backups/`
- Incremental backups (only changed files)
- Restore functionality

### 4. GitIgnore Management

- Auto-add generated paths to `.gitignore`
- Clean removal when rules are deleted
- Respect existing gitignore structure

### 5. Hooks System

```typescript
hooks: {
  beforeSync: [(context) => { /* custom logic */ }],
  afterRule: [(rule, content) => content.replace('__STRUCTURE__', getProjectStructure())],
  onError: [(error) => { /* error handling */ }]
}
```

### 6. CLI Commands

- `bunx ai-rules init` - Create initial config
- `bunx ai-rules sync` - Distribute rules to agents
- `bunx ai-rules validate` - Validate configuration
- `bunx ai-rules backup restore <timestamp>` - Restore from backup
- `bunx ai-rules clean` - Remove generated files

## Configuration Schema

```typescript
defineRules({
  configDir: '.ai-rules', // customizable
  rules: [
    {
      targets: ['claude', 'cursor'],
      file: '.ai-rules/main.md',
      to: './',
      globs: '**/*',
      agents: ['claude', 'cursor'], // optional override
      hooks: ['replaceStructure'] // per-rule hooks
    }
  ],

  commands: [
    {
      command: 'cleanup',
      file: '.ai-rules/commands/cleanup.md',
      agents: ['claude', 'cursor']
    }
  ],

  mcps: [
    {
      name: 'postgres',
      config: { /* MCP config */ },
      outputPath: 'claude_desktop_config.json' // configurable
    }
  ],

  hooks: {
    beforeSync: [],
    afterRule: [],
    onError: []
  },

  backup: {
    enabled: true,
    retention: 10 // keep last 10 backups
  }
})
```

## Implementation Steps

1. **Initialize Bun project with TypeScript** ✅
2. **Set up project structure and dependencies**
3. **Implement core types and configuration schema**
4. **Build configuration loader with multiple file support**
5. **Create agent-specific distributors**
6. **Implement backup system**
7. **Build .gitignore management**
8. **Create hooks system for extensibility**
9. **Implement CLI with commander**
10. **Add validation and error handling**
11. **Create tests and documentation**

## Agent-Specific Requirements

### Cursor

- Frontmatter with `description`, `globs`, `alwaysApply`
- Files in `.cursor/rules/`

### Claude Code

- Plain markdown files named `CLAUDE.md`
- Commands support

### Codex

- Plain markdown files named `AGENTS.md`

### Roo Code (Cline)

- Files in `.roo/rules/`
- Plain markdown format

## Future Extensibility

- Plugin system via hooks
- Custom agent configurations
- Template system
- Advanced file watching
- Integration with existing tools
