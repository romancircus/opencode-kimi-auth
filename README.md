# opencode-kimi-auth

[![npm version](https://img.shields.io/npm/v/opencode-kimi-auth.svg)](https://www.npmjs.com/package/opencode-kimi-auth)
[![License](https://img.shields.io/npm/l/opencode-kimi-auth.svg)](https://github.com/romancircus/opencode-kimi-auth/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

> OpenCode authentication plugin for Kimi models

An authentication plugin that enables seamless integration of Kimi (Kimi K2.5) models with OpenCode CLI. This plugin implements Kimi's official OAuth Device Authorization flow, providing secure token-based authentication with automatic token refresh.

## Features

- 🔐 **OAuth Device Authorization** - Secure device-based authentication flow with Kimi API
- 🚀 **Seamless OpenCode Integration** - Drop-in plugin for OpenCode CLI authentication system
- 🔄 **Auto-Token Refresh** - Automatic token refresh every 15 minutes (access tokens) and 30 days (refresh tokens)
- 🛡️ **Secure Token Storage** - Local secure storage in `~/.opencode-kimi-auth/oauth.json`
- ⚡ **Zero Config Setup** - Works out of the box with built-in Kimi client credentials
- 📦 **TypeScript Support** - Full type definitions included

## Installation

### Global Installation (Recommended)

```bash
npm install -g opencode-kimi-auth
```

### Project-Level Installation

```bash
npm install opencode-kimi-auth
```

## Quick Start

### 1. Install the Plugin

```bash
npm install -g opencode-kimi-auth
```

### 2. Use with OpenCode

Once OpenCode officially supports this plugin, add it to your OpenCode configuration:

```json
{
  "auth": {
    "kimi": {
      "plugin": "opencode-kimi-auth"
    }
  }
}
```

Then use Kimi models:

```bash
opencode --model kimi-k2.5 "Your prompt here"
```

### 3. First-Time Authentication

On first use, the plugin will:
1. Open your browser to Kimi's authorization page
2. Display a device code for you to verify
3. Once you approve, tokens are stored locally
4. Future uses are automatic - no re-authentication needed

## How It Works

### OAuth Device Authorization Flow

The plugin implements Kimi's official OAuth Device Authorization Grant:

```
1. Plugin requests device code from Kimi auth server
2. Plugin displays user code + authorization URL
3. User opens URL in browser and enters the code
4. User approves authorization on Kimi's website
5. Plugin polls for access token
6. Tokens stored securely: access_token (15 min expiry, auto-refresh) + refresh_token (30 days)
```

### Token Lifecycle

| Token Type | Lifetime | Behavior |
|------------|----------|----------|
| **Access Token** | 15 minutes | Used for API calls, auto-refreshed using refresh token |
| **Refresh Token** | 30 days | Used to obtain new access tokens silently |

**After initial authentication, you never need to re-authenticate.** The plugin handles all token management automatically in the background.

## Authentication Details

### Initial Setup

When you first use a Kimi model with OpenCode:

1. **Browser Opens** - Kimi authorization page loads
2. **Enter Device Code** - You'll see a code like `ABCD-EFGH` - enter it on the Kimi page
3. **Approve Access** - Click "Authorize" on Kimi's website
4. **Done** - Authentication complete, tokens stored locally

### Token Storage Location

Tokens are stored at:
```
~/.opencode-kimi-auth/oauth.json
```

This file contains:
- `access_token` - Short-lived API token (15 min)
- `refresh_token` - Long-lived token for refreshing (30 days)
- `expires_at` - Timestamp for auto-refresh calculation
- `device_id` - Unique device identifier

### When You Need to Re-Authenticate

You only need to re-authenticate if:
- You delete the token file (`~/.opencode-kimi-auth/oauth.json`)
- You want to switch to a different Kimi account
- The refresh token expires (after 30 days of inactivity)
- Kimi revokes access (rare)

## API Reference

### Programmatic Usage

```typescript
import { KimiOAuthClient } from 'opencode-kimi-auth';

// Initialize OAuth client
const client = new KimiOAuthClient({
  clientId: 'your-client-id',      // Optional - uses built-in default
  clientSecret: 'your-secret',     // Optional - uses built-in default
  scopes: ['kimi-code']            // Optional - default scope
});

// Start device authorization flow
const result = await client.authorize();
console.log('Visit:', result.verificationUri);
console.log('Enter code:', result.userCode);

// Tokens are automatically stored and refreshed
const accessToken = await client.getValidAccessToken();
```

### Types

```typescript
interface OAuthConfig {
  clientId?: string;        // OAuth client ID (uses default if not provided)
  clientSecret?: string;    // OAuth client secret (uses default if not provided)
  scopes?: string[];        // OAuth scopes (default: ['kimi-code'])
  tokenFilePath?: string;   // Custom token storage path
}

interface TokenData {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  expires_at: number;
  device_id: string;
}
```

## Troubleshooting

### Common Issues

#### "Authentication failed: Invalid client credentials"

**Cause:** OAuth client configuration issue

**Solution:** The plugin includes a working Kimi client ID (`17e5f671-d194-4dfb-9706-5516cb48c098`). If you're providing custom credentials, verify they are correct.

#### "Device code expired"

**Cause:** You took too long to authorize (codes expire after ~15 minutes)

**Solution:** Simply try again - a new device code will be generated automatically.

#### "Token refresh failed"

**Cause:** Refresh token expired or was revoked

**Solution:** Delete the token file and re-authenticate:
```bash
rm ~/.opencode-kimi-auth/oauth.json
# Then use the plugin again - it will prompt for fresh authentication
```

#### "OpenCode plugin not found"

**Cause:** OpenCode doesn't support this plugin yet (pending official integration)

**Solution:** This plugin is ready and published, but requires OpenCode to add it to their supported authentication plugins list. Track progress at: https://github.com/anomalyco/opencode/issues/12156

### Debug Mode

Enable debug logging:

```bash
export DEBUG=opencode-kimi-auth:*
opencode --model kimi-k2.5 "test"
```

### Getting Help

- 📖 [OpenCode Documentation](https://opencode.ai/docs)
- 🐛 [Report Issues](https://github.com/romancircus/opencode-kimi-auth/issues)
- 💬 [Kimi OAuth Documentation](https://platform.kimi.com/docs/auth/oauth)

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/romancircus/opencode-kimi-auth.git
cd opencode-kimi-auth

# Install dependencies
npm install

# Build
npm run build

# Type check
npm run typecheck
```

### Architecture

```
src/
├── index.ts          # Main entry point, OpenCode plugin interface
├── oauth.ts          # OAuth Device Authorization implementation
└── types.ts          # TypeScript type definitions
```

Key components:
- **Device Authorization Flow** - Implements RFC 8628 OAuth Device Authorization Grant
- **Token Management** - Automatic refresh, secure storage, lifecycle management
- **OpenCode Integration** - Plugin interface for OpenCode CLI auth system

## License

Apache-2.0 © [Roman Circus](https://github.com/romancircus)

---

<div align="center">
  <p>Built with ❤️ for the OpenCode community</p>
  <p>
    <a href="https://github.com/romancircus/opencode-kimi-auth">GitHub</a> •
    <a href="https://www.npmjs.com/package/opencode-kimi-auth">npm</a> •
    <a href="https://opencode.ai">OpenCode</a>
  </p>
</div>
