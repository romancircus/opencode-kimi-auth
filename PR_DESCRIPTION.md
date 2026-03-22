# PR: Migrate Kimi Auth Plugin to Anthropic SDK Format

## Summary
This PR migrates `opencode-kimi-auth` from the legacy provider setup to Anthropic SDK-compatible format (`@ai-sdk/anthropic`) while preserving OAuth behavior and adding an encrypted local token cache plus usage tracking.

## What Changed

### 1) Provider and Package Migration
- Updated dependency from `@openauthjs/openauth` to `@ai-sdk/anthropic`
- Bumped package version to `0.2.0`
- Switched provider identity to `kimi-for-coding`

### 2) Anthropic SDK-Compatible Auth Loader (`src/index.ts`)
- Auth loader now returns Anthropic SDK credentials shape:
  - `apiKey`
  - `headers.Authorization`
  - custom `fetch` with live token refresh and request header injection
- Uses OpenCode-provided OAuth credentials when available and falls back to plugin encrypted local cache
- Added provider hooks for command registration and command interception

### 3) Usage Tracking and Projection (`src/index.ts`)
- Added `/kimi-usage` command
- Added usage fetch/format logic against Kimi usage endpoint
- Added projection publishing on key session events (`session.created`, `session.updated`, `session.idle`)
- Updated command interception flow to avoid throw-based short-circuiting
- Clarified usage UI output by labeling quota values as `units` (for clearer interpretation)

### 4) Encrypted Token Storage (`src/oauth.ts`)
- Added AES-256-GCM encryption for plugin-managed local OAuth token cache
- Added local key generation and secure key file storage:
  - key: `~/.opencode-kimi-auth/.key`
  - tokens: `~/.opencode-kimi-auth/oauth.json`
  - file mode: `0o600`

### 5) Types and Docs
- Extended local plugin type definitions for `command.execute.before` and command registration in `config`
- Updated README and example config to Anthropic SDK format and current runtime behavior

## Breaking Changes

- Provider ID changed from `kimi` to `kimi-for-coding`
- Stored token format changed from plaintext JSON to encrypted wrapper

Existing users may need a one-time re-authentication after upgrade.

## Validation

- [x] `npm run typecheck`
- [x] `npm run build`

## Files of Interest

- `src/index.ts`
- `src/oauth.ts`
- `src/types.ts`
- `package.json`
- `package-lock.json`
- `README.md`
- `example-opencode.json`
