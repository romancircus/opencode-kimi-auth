# opencode-kimi-auth

[![npm version](https://img.shields.io/npm/v/opencode-kimi-auth.svg)](https://www.npmjs.com/package/opencode-kimi-auth)
[![License](https://img.shields.io/npm/l/opencode-kimi-auth.svg)](https://github.com/romancircus/opencode-kimi-auth/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

> OpenCode authentication plugin for Kimi (Moonshot AI) models with Anthropic SDK format

Enables OAuth Device Authorization flow for Kimi K2.5 and other Moonshot AI models in OpenCode CLI. This plugin handles secure token-based authentication with automatic refresh, an AES-256-GCM encrypted local token cache, and usage tracking.

## Features

- 🔐 **OAuth Device Authorization** - Secure device-based authentication with Kimi API
- 🚀 **Anthropic SDK Compatible** - Uses `@ai-sdk/anthropic` format for seamless integration
- 🔄 **Auto-Token Refresh** - Refreshes tokens near expiry with background polling
- 🛡️ **Encrypted Local Token Cache** - AES-256-GCM encryption with a local key file
- 📊 **Usage Tracking** - Built-in `/kimi-usage` command and automatic usage projections
- ⚡ **Zero Config Setup** - Works out of the box with built-in OAuth credentials
- 📦 **TypeScript Support** - Full type definitions included

## Quick Start

### 1. Install the Plugin

```bash
npm install -g opencode-kimi-auth
```

### 2. Configure OpenCode

Add the plugin to your OpenCode configuration (`~/.config/opencode/opencode.json`):

```json
{
  "model": "kimi-for-coding",
  "provider": {
    "kimi-for-coding": {
      "npm": "@ai-sdk/anthropic",
      "name": "Kimi for Coding",
      "options": {
        "baseURL": "https://api.kimi.com/coding/v1",
        "apiKey": "oauth-managed"
      },
      "models": {
        "kimi-for-coding": {
          "name": "Kimi For Coding"
        }
      }
    }
  },
  "plugin": ["opencode-kimi-auth"]
}
```

### 3. Authenticate (First Time Only)

```bash
opencode --model kimi-for-coding "Hello from Kimi"
```

On first use:
1. Your browser opens to Kimi's authorization page
2. You'll see a device code (e.g., `ABCD-EFGH`) - enter it on the Kimi page
3. Click "Authorize" on Kimi's website
4. Tokens are cached securely - future uses are automatic

### 4. That's It!

After initial authentication, the plugin handles all token management automatically.

## Usage Commands

### Check Usage

Run the `/kimi-usage` command in any OpenCode session:

```
/kimi-usage
```

This displays:
- Current plan level
- 7-day usage bar and remaining quota
- 5-hour usage bar and remaining quota
- Reset times for both windows

### Automatic Projections

The plugin automatically displays usage projections in the companion panel when:
- A new session is created
- Session is updated
- Session becomes idle

## How It Works

### OAuth Device Authorization Flow

```
1. Plugin requests device code from Kimi auth server
2. Plugin displays user code + authorization URL
3. User opens URL in browser and enters the code
4. User approves authorization on Kimi's website
5. Plugin polls for access token
6. Tokens cached securely with AES-256-GCM encryption
```

### Anthropic SDK Integration

The plugin returns credentials in Anthropic SDK format:

```typescript
{
  apiKey: string;           // Access token
  headers: {
    Authorization: string;  // Bearer token header
  };
  fetch: (input, init) => Promise<Response>; // Custom fetch with token refresh
}
```

This allows OpenCode to use the standard `@ai-sdk/anthropic` provider with Kimi's API.

### Token Lifecycle

| Token Type | Lifetime | Behavior |
|------------|----------|----------|
| **Access Token** | ~15 minutes | Used for API calls, refreshed when nearing expiry |
| **Refresh Token** | ~30 days | Used to obtain new access tokens silently |

**After initial authentication, you typically won't need to re-authenticate.** If a refresh token expires or is revoked, delete the token file and authenticate again.

## Configuration

### Global Configuration

Edit `~/.config/opencode/opencode.json`:

```json
{
  "model": "kimi-for-coding",
  "provider": {
    "kimi-for-coding": {
      "npm": "@ai-sdk/anthropic",
      "name": "Kimi for Coding",
      "options": {
        "baseURL": "https://api.kimi.com/coding/v1",
        "apiKey": "oauth-managed"
      },
      "models": {
        "kimi-for-coding": {
          "name": "Kimi For Coding"
        },
        "k2p5": {
          "name": "Kimi K2.5 (alias)"
        }
      }
    }
  },
  "plugin": ["opencode-kimi-auth"]
}
```

### Using API Key Instead of OAuth

If you prefer using a direct API key instead of OAuth:

```json
{
  "model": "kimi-for-coding",
  "provider": {
    "kimi-for-coding": {
      "npm": "@ai-sdk/anthropic",
      "name": "Kimi for Coding",
      "options": {
        "baseURL": "https://api.kimi.com/coding/v1",
        "apiKey": "your-kimi-api-key"
      }
    }
  }
}
```

## Token Storage Location

The plugin's local token cache is stored at:
```
~/.opencode-kimi-auth/oauth.json
```

This file contains encrypted token data using AES-256-GCM encryption.

OpenCode may also keep provider credentials in its own auth store as part of normal `/auth` behavior. That store is managed by OpenCode, while this plugin's local cache remains encrypted at rest.

### Encryption Details

- **Algorithm**: AES-256-GCM with authentication tags
- **Key Generation**: SHA-256 over machine metadata plus 32 random bytes (stored locally)
- **Key Storage**: `~/.opencode-kimi-auth/.key` with `0o600` permissions
- **Token File**: `~/.opencode-kimi-auth/oauth.json` with `0o600` permissions

The key file and encrypted token file are both stored locally with restricted permissions. Keep both files private.

## Troubleshooting

### "Authentication failed: Invalid client credentials"

**Cause:** OAuth client configuration issue

**Solution:** The default client ID should work. If you're providing custom credentials via `KIMI_CLIENT_ID` environment variable, verify they are correct.

### "Device code expired"

**Cause:** You took too long to authorize (codes expire after ~15 minutes)

**Solution:** Simply try again - a new device code will be generated automatically.

### "Token refresh failed"

**Cause:** Refresh token expired or was revoked

**Solution:** Delete the token file and re-authenticate:

```bash
rm ~/.opencode-kimi-auth/oauth.json
# Then use the plugin again - it will prompt for fresh authentication
```

### "No Kimi OAuth credentials found"

**Cause:** Not authenticated yet

**Solution:** Run `/auth` in OpenCode and select "Kimi Code Subscription" to authenticate.

### Plugin not loading

**Cause:** OpenCode can't find the plugin

**Solution:**

1. Verify the plugin is installed: `npm list -g opencode-kimi-auth`
2. Check your `opencode.json` syntax is valid JSON
3. Try specifying the full path: `"plugin": ["/path/to/opencode-kimi-auth"]`

### Debug Mode

Enable debug logging:

```bash
export DEBUG=opencode-kimi-auth:*
opencode --model kimi-for-coding "test"
```

## Advanced Usage

### Custom OAuth Client

If you have your own Kimi OAuth app, override the client ID:

```bash
export KIMI_CLIENT_ID="your-custom-client-id"
opencode --model kimi-for-coding "Hello"
```

### Programmatic Usage

```typescript
import { KimiAuthPlugin } from 'opencode-kimi-auth';

// The plugin is designed to be loaded by OpenCode CLI
// It exports a standard OpenCode plugin interface
export default KimiAuthPlugin;
```

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
├── index.ts          # Main plugin with Anthropic SDK integration
├── oauth.ts          # OAuth Device Authorization + encryption
└── types.ts          # TypeScript type definitions
```

Key components:

- **Device Authorization Flow** - Implements RFC 8628 OAuth Device Authorization Grant
- **Token Management** - Automatic refresh, encrypted local cache, lifecycle management
- **Anthropic SDK Integration** - Returns credentials in `@ai-sdk/anthropic` format
- **Usage Tracking** - Fetches and displays quota usage from Kimi API
- **OpenCode Integration** - Plugin interface for OpenCode CLI auth system

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

- Plugin-managed local tokens are encrypted at rest using AES-256-GCM
- Encryption keys are local files stored with `0o600` permissions
- No secrets are logged or transmitted to third parties
- OAuth Device Authorization is the most secure flow for CLI applications
- All communication is over HTTPS

Report security vulnerabilities to [security@romancircus.com](mailto:security@romancircus.com).

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
