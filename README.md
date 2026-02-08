# opencode-kimi-auth

[![npm version](https://img.shields.io/npm/v/opencode-kimi-auth.svg)](https://www.npmjs.com/package/opencode-kimi-auth)
[![License](https://img.shields.io/npm/l/opencode-kimi-auth.svg)](https://github.com/romancircus/opencode-kimi-auth/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

> OpenCode authentication plugin for Kimi (Moonshot AI) models

Enables OAuth Device Authorization flow for Kimi K2.5 and other Moonshot AI models in OpenCode CLI. This plugin handles secure token-based authentication with automatic refresh, so you never need to re-authenticate after the initial setup.

## Features

- 🔐 **OAuth Device Authorization** - Secure device-based authentication with Kimi API
- 🚀 **Drop-in OpenCode Plugin** - Add to your `opencode.json` and it just works
- 🔄 **Auto-Token Refresh** - Automatic refresh every 15 minutes (access tokens) and 30 days (refresh tokens)
- 🛡️ **Secure Token Storage** - Local secure storage in `~/.opencode-kimi-auth/oauth.json`
- ⚡ **Zero Config Setup** - Works out of the box with built-in OAuth credentials
- 📦 **TypeScript Support** - Full type definitions included

## Quick Start

### 1. Install the Plugin

```bash
npm install -g opencode-kimi-auth
```

### 2. Configure OpenCode

Add the plugin to your OpenCode configuration (`~/.config/opencode/opencode.json` for global use, or `opencode.json` in your project):

```json
{
  "model": "kimi-k2.5",
  "plugin": ["opencode-kimi-auth"]
}
```

Or use the provided example:

```bash
cp example-opencode.json ~/.config/opencode/opencode.json
```

### 3. Authenticate (First Time Only)

```bash
opencode --model kimi-k2.5 "Hello from Kimi"
```

On first use:
1. Your browser opens to Kimi's authorization page
2. You'll see a device code (e.g., `ABCD-EFGH`) - enter it on the Kimi page
3. Click "Authorize" on Kimi's website
4. Tokens are stored locally - future uses are automatic

### 4. That's It!

After initial authentication, the plugin handles all token management automatically. You'll never need to re-authenticate unless:
- You delete `~/.opencode-kimi-auth/oauth.json`
- You want to switch Kimi accounts
- The refresh token expires (after 30 days of inactivity)

## How It Works

### OAuth Device Authorization Flow

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

## Configuration

### Global Configuration

Edit `~/.config/opencode/opencode.json`:

```json
{
  "model": "kimi-k2.5",
  "provider": {
    "kimi": {
      "api": {
        "url": "https://api.moonshot.cn/v1"
      }
    }
  },
  "plugin": ["opencode-kimi-auth"],
  "auth": {
    "kimi": {
      "type": "oauth"
    }
  }
}
```

### Project-Level Configuration

Create `opencode.json` in your project root:

```json
{
  "plugin": ["opencode-kimi-auth"]
}
```

### Using API Key Instead of OAuth

If you prefer using a direct API key instead of OAuth:

```json
{
  "model": "kimi-k2.5",
  "provider": {
    "kimi": {
      "api": {
        "url": "https://api.moonshot.cn/v1",
        "key": "your-kimi-api-key"
      }
    }
  }
}
```

## Token Storage Location

Tokens are stored at:
```
~/.opencode-kimi-auth/oauth.json
```

This file contains:
- `access_token` - Short-lived API token (15 min)
- `refresh_token` - Long-lived token for refreshing (30 days)
- `expires_at` - Timestamp for auto-refresh calculation
- `device_id` - Unique device identifier

**Security note:** The token file is created with `0o600` permissions (readable only by owner).

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
opencode --model kimi-k2.5 "test"
```

## Advanced Usage

### Custom OAuth Client

If you have your own Kimi OAuth app, override the client ID:

```bash
export KIMI_CLIENT_ID="your-custom-client-id"
opencode --model kimi-k2.5 "Hello"
```

### Programmatic Usage

```typescript
import { KimiOAuthClient } from 'opencode-kimi-auth';

// Initialize OAuth client
const client = new KimiOAuthClient({
  clientId: 'your-client-id',      // Optional - uses built-in default
  scopes: ['kimi-code']            // Optional - default scope
});

// Start device authorization flow
const result = await client.authorize();
console.log('Visit:', result.verificationUri);
console.log('Enter code:', result.userCode);

// Tokens are automatically stored and refreshed
const accessToken = await client.getValidAccessToken();
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
├── index.ts          # Main entry point, OpenCode plugin interface
├── oauth.ts          # OAuth Device Authorization implementation
└── types.ts          # TypeScript type definitions
```

Key components:
- **Device Authorization Flow** - Implements RFC 8628 OAuth Device Authorization Grant
- **Token Management** - Automatic refresh, secure storage, lifecycle management
- **OpenCode Integration** - Plugin interface for OpenCode CLI auth system

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

- Tokens are stored locally with `0o600` file permissions
- No secrets are logged or transmitted to third parties
- OAuth Device Authorization is the most secure flow for CLI applications
- All communication is over HTTPS

Report security vulnerabilities to [security@romancircus.com](mailto:security@romancircus.com).

## License

Apache-2.0 © Roman Circus Studio

See [LICENSE](LICENSE) for full details.

---

<div align="center">
  <p>Built with ❤️ for the OpenCode community</p>
  <p>
    <a href="https://github.com/romancircus/opencode-kimi-auth">GitHub</a> •
    <a href="https://www.npmjs.com/package/opencode-kimi-auth">npm</a> •
    <a href="https://opencode.ai">OpenCode</a>
  </p>
</div>
