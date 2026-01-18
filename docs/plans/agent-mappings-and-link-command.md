# Agent Mapping Gap Analysis + Zero-Config Link Command

## Part 1: Missing Agent Mappings

### Current Support Summary

**Supported Agents:** claude, cursor, codex, roocode, opencode, generic

| Feature | Claude | Cursor | Codex | RooCode | OpenCode |
|---------|--------|--------|-------|---------|----------|
| Rules | ✅ `CLAUDE.md` | ✅ `.cursor/rules/` | ✅ `AGENTS.md` | ✅ `.roo/rules/` | ✅ `AGENTS.md` |
| Commands | ✅ `.claude/commands/` | ✅ `.cursor/commands/` | ❌ | ❌ | ✅ `.opencode/command/` |
| Skills | ✅ `.claude/skills/` | ✅ `.cursor/skills/` | ❌ | ❌ | ✅ (Claude path) |
| Agents | ✅ `.claude/agents/` | ✅ `.cursor/agents/` | ❌ | ❌ | ✅ `.opencode/agent/` |
| Hooks | ✅ settings.json | ✅ hooks.json | ❌ | ❌ | ❌ |

---

### Feature 1: Add Factory Agent (New)

Based on [Factory AI docs](https://docs.factory.ai/cli/configuration/settings):

**Project-relative paths:**
| Feature | Path |
|---------|------|
| Rules | `.factory/AGENTS.md` |
| Skills | `.factory/skills/<name>/SKILL.md` |
| Droids | `.factory/droids/` |
| Hooks | `.factory/settings.json` (hooks key) |

**Files to modify:**

1. `src/types/index.ts:3` - Add `'factory'` to AgentName
2. `src/types/index.ts:157-158` - Add to `isValidAgentName`
3. `src/agents/index.ts:9-25` - Add to AGENT_DIRECTORY_MAPPINGS:
   ```typescript
   skills: { factory: '.factory/skills' },
   agents: { factory: '.factory/droids' },
   ```
4. `src/agents/index.ts:38-71` - Add to AGENT_MAPPINGS:
   ```typescript
   factory: {
     path: 'AGENTS.md',
     format: 'markdown',
     directory: '.factory',
     mcpPath: '.factory/settings.json'
   }
   ```
5. `src/agents/hooks-distributor.ts` - Add Factory hook distribution (same format as Claude)
6. `src/core/config-loader.ts:152` - Add `'factory'` to validAgentNames

---

### Feature 2: Expand Codex Support

Based on [Codex Custom Prompts docs](https://developers.openai.com/codex/custom-prompts/) and [Skills docs](https://developers.openai.com/codex/skills/):

**Project-relative paths:**
| Feature | Path | Notes |
|---------|------|-------|
| Rules | `.codex/AGENTS.md` | |
| Commands | `.codex/prompts/` | Equivalent to Claude's commands |
| Skills | `.codex/skills/` | Uses SKILL.md format |

**Files to modify:**

1. `src/agents/index.ts:9-25` - Add Codex to AGENT_DIRECTORY_MAPPINGS:
   ```typescript
   commands: { codex: '.codex/prompts' },  // Note: "prompts" not "commands"
   skills: { codex: '.codex/skills' },
   ```
2. `src/agents/index.ts:50-54` - Update Codex in AGENT_MAPPINGS:
   ```typescript
   codex: {
     path: 'AGENTS.md',
     format: 'markdown',
     directory: '.codex',  // Add this
     mcpPath: '.codex/config.toml'  // Update path
   }
   ```

---

## Part 2: Zero-Config Link Command

### Usage
```bash
bunx glooit link                        # Symlink .agents/ to all supported agents
bunx glooit link .glooit                # Symlink from .glooit/ directory
bunx glooit link -t claude,cursor       # Symlink to specific agents only
bunx glooit link .glooit -t claude      # Combine source dir and targets
```

### How it works

1. Accept optional positional argument for source directory (defaults to `.agents/`, falls back to `.glooit/`)
2. Scan for known patterns:
   - `CLAUDE.md` → sync to Claude
   - `AGENTS.md` → sync to Codex, OpenCode, Factory
   - `commands/` → sync commands directory
   - `skills/` → sync skills directory
   - `agents/` → sync agents directory
3. Build virtual config with `mode: 'symlink'` and run distributor
4. No `glooit.config.ts` required

### Implementation

Add to `src/cli/index.ts`:

```typescript
program
  .command('link')
  .description('Zero-config symlink: auto-sync .agents/ to all supported agents')
  .argument('[source]', 'source directory (default: .agents, fallback: .glooit)')
  .option('-t, --targets <agents>', 'comma-separated list of agents (default: all)')
  .action(async (source, options) => {
    await linkCommand(source, options.targets);
  });
```

New function `linkCommand(source?: string, targets?: string)` (~80 lines):
1. Resolve source dir: use provided arg, or default to `.agents/`, or fall back to `.glooit/`
2. Scan for files/directories
3. Build config object with discovered rules and `mode: 'symlink'`
4. Create `AIRulesCore` and call `sync()`

Note: `--copy` option is intentionally omitted - use `glooit sync` for copy mode (requires config file).

The existing `unlink` command already works without config - it reads from the manifest to find symlinks to replace.

---

## Files to Modify (Summary)

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `factory` to AgentName, update validation |
| `src/agents/index.ts` | Add Factory config, add Codex/Factory directory mappings |
| `src/agents/hooks-distributor.ts` | Add Factory hook support |
| `src/core/config-loader.ts` | Add `factory` to validAgentNames |
| `src/cli/index.ts` | Add `link` command |

---

## Verification

1. Run existing tests: `bun test`
2. Test Factory agent:
   ```bash
   mkdir -p .agents/skills/test-skill
   echo "---\nname: test\n---\nTest" > .agents/skills/test-skill/SKILL.md
   bunx glooit link
   # Verify .factory/skills/test-skill/SKILL.md exists as symlink
   ```
3. Test Codex support:
   ```bash
   # Verify .codex/skills/test-skill/SKILL.md exists as symlink
   # Verify .codex/prompts/ has commands symlinked
   ```
4. Test zero-config link:
   ```bash
   rm glooit.config.ts  # Remove config
   bunx glooit link     # Should still work
   ```
