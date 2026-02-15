# Settings Support Plan (Provider-Native Merge)

## Goal

Implement a single **generic glooit settings config** that is merged into each provider's own settings file format.

The key principle:

- Users define settings once in glooit.
- glooit maps and merges that into each provider's native file structure.
- No provider-specific top-level config sections like `claude: {...}`.

## Scope

In scope:

- Generic config schema for settings.
- Provider adapters for `claude`, `cursor`, `codex`, `opencode` (and `factory` if supported).
- Merge logic into existing provider files.
- Env key lookup from optional env files and process env.
- Permission handling mapped per provider.

Out of scope:

- MCP config changes.
- Rule/commands/skills sync changes.
- Hook behavior changes.

## Product Requirements

1. Single glooit settings entrypoint.
2. Merge into existing provider settings (never full overwrite unless explicitly configured).
3. Provider-native output format:
   - JSON for tools that use JSON.
   - TOML for Codex.
   - Any provider-specific shape preserved.
4. Deterministic merge precedence.
5. Graceful handling where a provider does not support a generic field directly.

## Proposed Config Shape

```ts
settings: {
  targets?: ['claude', 'cursor', 'codex', 'opencode', 'factory'],
  env?: string[],                  // e.g. ['GEMINI_API_KEY', 'OPENAI_API_KEY']
  envFiles?: string[],             // optional, e.g. ['.env', '.env.local']
  permissions?: Record<string, unknown>,
  merge?: boolean                  // default: true
}
```

Notes:

- Keep this under `settings` (generic), not `runtime` and not per-provider top-level blocks.
- `targets` defaults to all supported providers for settings merging.
- `envFiles` is optional; if omitted, resolve from `process.env` only.

## Merge Semantics

### Env resolution

For each key in `settings.env`, resolve value with precedence:

1. `process.env[KEY]`
2. First match from `settings.envFiles` in declared order (if provided)

If key is not found, skip and warn.

When provider supports stored env in settings, merge resolved keys into provider format.

### Permissions merge

Final permissions for an agent:

1. Existing file permissions block
2. `permissions`

Use deep object merge for permission objects.

### File behavior

- `merge: true`:
  - Load existing provider settings file.
  - Merge only mapped keys.
  - Preserve unknown keys.
- `merge: false`:
  - Start from empty provider settings object/file.
  - Write only mapped keys.

## Provider Mapping Plan

## Claude

- File: `.claude/settings.local.json` (default)
- Env: `env` object
- Permissions: `permissions` object

## Cursor

- File: `.cursor/cli.json` (default)
- Permissions: mapped to Cursor permissions section
- Env: apply only if Cursor has stable native settings env mapping; otherwise warn and skip env keys

## Codex

- File: `.codex/config.toml` (default)
- Env: map into Codex shell env policy section (provider-native TOML)
- Permissions: map `approval_policy`, `sandbox_mode`, and related policy keys

## OpenCode

- File: `opencode.json` (default)
- Permissions: `permission` block
- Env: map using OpenCode native env strategy in settings (not MCP)

## Factory (optional in phase 1)

- File: provider-native settings file
- Map only fields with clear support.

## Error/Warning Strategy

Warn (non-fatal) when:

- A field is requested but provider has no stable native mapping.
- Existing file is invalid; recover by starting fresh (if merge mode).

Error when:

- Output path is invalid/unwritable.
- `settings.targets` contains unknown agents.

## Implementation Plan

1. Add `SettingsConfig` type to `src/types/index.ts`.
2. Add a dedicated settings distributor/adapter layer:
   - `src/agents/settings-distributor.ts`
   - Provider-specific mapping helpers (JSON/TOML writers).
3. Wire distributor into `AIRulesCore.sync()` after rule/mcp/hooks sync.
4. Add generated settings paths into:
   - manifest tracking
   - gitignore manager
5. Add simple env resolver utility for `envFiles` + `process.env`.
6. Update README + `examples/full.config.ts` to use generic `settings`.

## Test Plan

Unit tests:

- Generic merge precedence for env + permissions.
- Env key resolution from `process.env` and optional `envFiles`.
- Provider adapters:
  - Claude JSON merge
  - Cursor JSON merge
  - Codex TOML upsert/merge
  - OpenCode JSON merge
- Invalid existing file recovery.
- `merge: false` overwrite behavior.

Integration tests:

- End-to-end `glooit sync` with `settings` for multiple targets.
- Gitignore + manifest include generated settings files.

## Acceptance Criteria

1. One generic `settings` config applies across providers.
2. Existing provider settings are preserved and merged in merge mode.
3. Provider-specific output files are valid in native format.
4. Unsupported mappings produce clear warnings, not silent drops.
5. Test suite passes with coverage thresholds.

## Open Questions

1. Should `settings.targets` default include `factory` in phase 1?
2. For OpenCode env, should glooit write provider env refs directly or only scaffold placeholders?
3. Should missing env keys be warning-only or fail in strict mode?
