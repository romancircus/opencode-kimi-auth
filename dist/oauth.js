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
const KEY_FILE = path.join(AUTH_DIR, '.key');
// Encryption constants
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
function isEncryptedTokenWrapper(value) {
    return Boolean(value) && typeof value.encrypted === 'string';
}
function isStoredToken(value) {
    if (!value || typeof value !== 'object')
        return false;
    const token = value;
    return (typeof token.access_token === 'string' &&
        typeof token.refresh_token === 'string' &&
        typeof token.token_type === 'string' &&
        typeof token.expires_at === 'number');
}
/**
 * Get or generate encryption key
 * The key is derived from machine-specific data combined with random bytes
 */
async function getEncryptionKey() {
    try {
        // Try to read existing key
        const keyData = await fs.readFile(KEY_FILE);
        return keyData;
    }
    catch {
        // Generate a new key using machine-specific data + random bytes
        const machineData = `${os.hostname()}-${os.userInfo().username}-${os.platform()}`;
        const randomBytes = crypto.randomBytes(KEY_LENGTH);
        const hash = crypto.createHash('sha256');
        hash.update(machineData);
        hash.update(randomBytes);
        const key = hash.digest();
        // Store key with restricted permissions
        await fs.mkdir(AUTH_DIR, { recursive: true });
        await fs.writeFile(KEY_FILE, key, { mode: 0o600 });
        return key;
    }
}
/**
 * Encrypt data using AES-256-GCM
 */
async function encrypt(data) {
    const key = await getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    // Combine IV + authTag + encrypted data
    const result = Buffer.concat([iv, authTag, encrypted]);
    return result.toString('base64');
}
/**
 * Decrypt data using AES-256-GCM
 */
async function decrypt(encryptedData) {
    const key = await getEncryptionKey();
    const data = Buffer.from(encryptedData, 'base64');
    // Extract IV, authTag, and encrypted content
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);
    return decrypted.toString('utf8');
}
// Get or generate device ID
async function getDeviceId() {
    const deviceIdFile = path.join(AUTH_DIR, 'device_id');
    try {
        const id = await fs.readFile(deviceIdFile, 'utf-8');
        return id.trim();
    }
    catch {
        // Generate new device ID
        const id = crypto.randomUUID();
        await fs.mkdir(AUTH_DIR, { recursive: true });
        await fs.writeFile(deviceIdFile, id, { mode: 0o600 });
        return id;
    }
}
// Get device headers
async function getDeviceHeaders() {
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
export async function requestDeviceAuthorization() {
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
    const data = await response.json();
    if (!data.device_code || !data.user_code || !data.verification_uri_complete) {
        throw new Error('Invalid device authorization response: missing required fields');
    }
    return data;
}
// Poll for token
export async function pollForToken(deviceCode, options) {
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
            const tokenData = await response.json();
            if (!tokenData.access_token || !tokenData.refresh_token) {
                throw new Error('Invalid token response: missing access_token or refresh_token');
            }
            // Store the token with expiration
            await storeToken(tokenData);
            return tokenData;
        }
        const errorData = await response.json().catch(() => ({ error: 'unknown' }));
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
export async function refreshToken(refreshToken) {
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
    const tokenData = await response.json();
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
// Store token (encrypted)
export async function storeToken(token) {
    const deviceId = await getDeviceId();
    const storedToken = {
        ...token,
        expires_at: Date.now() + (token.expires_in * 1000),
        device_id: deviceId,
    };
    // Encrypt the token data
    const encrypted = await encrypt(JSON.stringify(storedToken));
    await fs.mkdir(AUTH_DIR, { recursive: true });
    await fs.writeFile(TOKEN_FILE, JSON.stringify({ encrypted }, null, 2), { mode: 0o600 });
}
// Get token with auto-refresh (decrypts stored token)
export async function getToken() {
    try {
        const data = await fs.readFile(TOKEN_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        let storedToken;
        const isLegacyPlaintext = isStoredToken(parsed);
        if (isEncryptedTokenWrapper(parsed)) {
            // Decrypt the token data
            const decrypted = await decrypt(parsed.encrypted);
            const decryptedParsed = JSON.parse(decrypted);
            if (!isStoredToken(decryptedParsed)) {
                return null;
            }
            storedToken = decryptedParsed;
        }
        else if (isLegacyPlaintext) {
            storedToken = parsed;
        }
        else {
            return null;
        }
        // Check if token is expired or about to expire (within 5 minutes)
        const expiresSoon = storedToken.expires_at - Date.now() < 300000;
        if (expiresSoon && storedToken.refresh_token) {
            // Refresh the token
            const newToken = await refreshToken(storedToken.refresh_token);
            return newToken;
        }
        // One-time migration path from legacy plaintext tokens to encrypted wrapper.
        if (isLegacyPlaintext) {
            const remainingSeconds = Math.max(1, Math.floor((storedToken.expires_at - Date.now()) / 1000));
            await storeToken({
                access_token: storedToken.access_token,
                refresh_token: storedToken.refresh_token,
                token_type: storedToken.token_type,
                expires_in: remainingSeconds,
                scope: storedToken.scope,
            });
        }
        // Return stored token (not expired yet)
        return {
            access_token: storedToken.access_token,
            refresh_token: storedToken.refresh_token,
            token_type: storedToken.token_type,
            expires_in: Math.floor((storedToken.expires_at - Date.now()) / 1000),
            scope: storedToken.scope,
        };
    }
    catch {
        return null;
    }
}
// Utility function for sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Clear stored credentials (useful for logout)
export async function clearCredentials() {
    try {
        await fs.unlink(TOKEN_FILE);
    }
    catch {
        // Ignore errors if file doesn't exist
    }
}
// Check if authenticated
export async function isAuthenticated() {
    const token = await getToken();
    return token !== null;
}
