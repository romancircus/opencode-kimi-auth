import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// Constants
// OAuth Client ID for Kimi API - this is a public identifier (not a secret)
// For custom OAuth apps, override via KIMI_CLIENT_ID environment variable
const CLIENT_ID = process.env.KIMI_CLIENT_ID || '17e5f671-d194-4dfb-9706-5516cb48c098';
const DEVICE_AUTH_ENDPOINT = 'https://auth.kimi.com/api/oauth/device_authorization';
const TOKEN_ENDPOINT = 'https://auth.kimi.com/api/oauth/token';
const DEFAULT_POLL_INTERVAL = 5000; // 5 seconds
const DEFAULT_TIMEOUT = 600000; // 10 minutes

// Storage path
const AUTH_DIR = path.join(os.homedir(), '.opencode-kimi-auth');
const TOKEN_FILE = path.join(AUTH_DIR, 'oauth.json');

// Types
export interface DeviceAuthorizationResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface StoredToken extends TokenResponse {
  expires_at: number; // Unix timestamp
  device_id: string;
}

// Get or generate device ID
async function getDeviceId(): Promise<string> {
  const deviceIdFile = path.join(AUTH_DIR, 'device_id');
  
  try {
    const id = await fs.readFile(deviceIdFile, 'utf-8');
    return id.trim();
  } catch {
    // Generate new device ID
    const id = crypto.randomUUID();
    await fs.mkdir(AUTH_DIR, { recursive: true });
    await fs.writeFile(deviceIdFile, id, { mode: 0o600 });
    return id;
  }
}

// Get device headers
async function getDeviceHeaders(): Promise<Record<string, string>> {
  const deviceId = await getDeviceId();
  
  return {
    'X-Msh-Platform': 'opencode',
    'X-Msh-Version': '0.1.0',
    'X-Msh-Device-Name': os.hostname(),
    'X-Msh-Device-Model': `${os.platform()}-${os.arch()}`,
    'X-Msh-Os-Version': os.release(),
    'X-Msh-Device-Id': deviceId,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

// Request device authorization
export async function requestDeviceAuthorization(): Promise<DeviceAuthorizationResponse> {
  const headers = await getDeviceHeaders();
  
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
  });
  
  const response = await fetch(DEVICE_AUTH_ENDPOINT, {
    method: 'POST',
    headers,
    body: params.toString(),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Device authorization failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const data = await response.json() as DeviceAuthorizationResponse;
  
  if (!data.device_code || !data.user_code || !data.verification_uri_complete) {
    throw new Error('Invalid device authorization response: missing required fields');
  }
  
  return data;
}

// Poll for token
export async function pollForToken(
  deviceCode: string,
  options?: {
    pollInterval?: number;
    timeout?: number;
  }
): Promise<TokenResponse> {
  const { pollInterval = DEFAULT_POLL_INTERVAL, timeout = DEFAULT_TIMEOUT } = options || {};
  const headers = await getDeviceHeaders();
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const params = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: deviceCode,
      client_id: CLIENT_ID,
    });
    
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers,
      body: params.toString(),
    });
    
    if (response.ok) {
      const tokenData = await response.json() as TokenResponse;
      
      if (!tokenData.access_token || !tokenData.refresh_token) {
        throw new Error('Invalid token response: missing access_token or refresh_token');
      }
      
      // Store the token with expiration
      await storeToken(tokenData);
      return tokenData;
    }
    
    const errorData = await response.json().catch(() => ({ error: 'unknown' })) as { error: string; interval?: number };
    
    // Handle specific OAuth errors
    if (errorData.error === 'authorization_pending') {
      // User hasn't authorized yet, continue polling
      await sleep(pollInterval);
      continue;
    }
    
    if (errorData.error === 'slow_down') {
      // Server requests slower polling
      const newInterval = (errorData.interval || pollInterval + 5000);
      await sleep(newInterval);
      continue;
    }
    
    if (errorData.error === 'expired_token') {
      throw new Error('Device code expired. Please restart the authorization flow.');
    }
    
    if (errorData.error === 'access_denied') {
      throw new Error('Authorization denied by user.');
    }
    
    throw new Error(`Token request failed: ${errorData.error || response.statusText}`);
  }
  
  throw new Error('Authorization timeout. Device code expired.');
}

// Refresh token
export async function refreshToken(refreshToken: string): Promise<TokenResponse> {
  const headers = await getDeviceHeaders();
  
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers,
    body: params.toString(),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const tokenData = await response.json() as TokenResponse;
  
  if (!tokenData.access_token) {
    throw new Error('Invalid refresh response: missing access_token');
  }
  
  // Preserve refresh token if not returned
  if (!tokenData.refresh_token) {
    tokenData.refresh_token = refreshToken;
  }
  
  // Store the new token
  await storeToken(tokenData);
  return tokenData;
}

// Store token
export async function storeToken(token: TokenResponse): Promise<void> {
  const deviceId = await getDeviceId();
  
  const storedToken: StoredToken = {
    ...token,
    expires_at: Date.now() + (token.expires_in * 1000),
    device_id: deviceId,
  };
  
  await fs.mkdir(AUTH_DIR, { recursive: true });
  await fs.writeFile(
    TOKEN_FILE,
    JSON.stringify(storedToken, null, 2),
    { mode: 0o600 }
  );
}

// Get token with auto-refresh
export async function getToken(): Promise<TokenResponse | null> {
  try {
    const data = await fs.readFile(TOKEN_FILE, 'utf-8');
    const storedToken: StoredToken = JSON.parse(data);
    
    // Check if token is expired or about to expire (within 5 minutes)
    const expiresSoon = storedToken.expires_at - Date.now() < 300000;
    
    if (expiresSoon && storedToken.refresh_token) {
      // Refresh the token
      const newToken = await refreshToken(storedToken.refresh_token);
      return newToken;
    }
    
    // Return stored token (not expired yet)
    return {
      access_token: storedToken.access_token,
      refresh_token: storedToken.refresh_token,
      token_type: storedToken.token_type,
      expires_in: Math.floor((storedToken.expires_at - Date.now()) / 1000),
      scope: storedToken.scope,
    };
  } catch {
    return null;
  }
}

// Utility function for sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Clear stored credentials (useful for logout)
export async function clearCredentials(): Promise<void> {
  try {
    await fs.unlink(TOKEN_FILE);
  } catch {
    // Ignore errors if file doesn't exist
  }
}

// Check if authenticated
export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  return token !== null;
}
