import type { Auth, Hooks, Plugin, PluginInput } from "./types.js";
import {
  requestDeviceAuthorization,
  pollForToken,
  refreshToken,
  storeToken,
  getToken,
} from "./oauth.js";

const KIMI_API_BASE_URL = "https://api.kimi.com/coding/v1";
const KIMI_USAGE_URL = "https://api.kimi.com/coding/v1/usages";
const REFRESH_INTERVAL_MS = 60 * 1000; // 60 seconds
const EXPIRY_THRESHOLD_S = 300; // 300 seconds before expiry
const PROJECTION_REFRESH_MS = 90 * 1000; // 90 seconds
const KIMI_USAGE_HANDLED_ERROR = "__KIMI_USAGE_HANDLED__";

// Cache for OAuth tokens with refresh state
const tokenCache = new Map<
  string,
  {
    access: string;
    refresh: string;
    expires: number;
    refreshTimer?: ReturnType<typeof setInterval>;
  }
>();

type OAuthCredentials = { type: "oauth"; access: string; refresh: string; expires: number };

function isOAuthCredentialRecord(value: any): value is OAuthCredentials {
  return (
    value &&
    value.type === "oauth" &&
    typeof value.access === "string" &&
    typeof value.refresh === "string" &&
    typeof value.expires === "number"
  );
}

async function readOAuthCredentialsFromClient(client: any, providerKey: string): Promise<OAuthCredentials | null> {
  const authGet = client?.auth?.get;
  if (typeof authGet !== "function") return null;

  try {
    const result = await authGet({ path: { id: providerKey } });
    const body = result?.body ?? result;
    return isOAuthCredentialRecord(body) ? body : null;
  } catch {
    return null;
  }
}

/**
 * Start automatic token refresh for a cached token
 */
function startTokenRefresh(
  providerKey: string,
  accessToken: string,
  refreshTokenStr: string,
  expiresAt: number
): void {
  const existing = tokenCache.get(providerKey);
  if (existing?.refreshTimer) {
    clearInterval(existing.refreshTimer);
  }

  const refreshTimer = setInterval(async () => {
    const cached = tokenCache.get(providerKey);
    if (!cached) return;

    const timeUntilExpiry = cached.expires - Math.floor(Date.now() / 1000);
    if (timeUntilExpiry <= EXPIRY_THRESHOLD_S) {
      try {
        const newToken = await refreshToken(cached.refresh);
        const nextRefreshToken = newToken.refresh_token || cached.refresh;
        const nextExpiresAt = Math.floor(Date.now() / 1000) + newToken.expires_in;
        tokenCache.set(providerKey, {
          access: newToken.access_token,
          refresh: nextRefreshToken,
          expires: nextExpiresAt,
          refreshTimer,
        });
        await storeToken(newToken);
      } catch (error) {
        console.error("Failed to refresh Kimi token:", error);
      }
    }
  }, REFRESH_INTERVAL_MS);

  tokenCache.set(providerKey, {
    access: accessToken,
    refresh: refreshTokenStr,
    expires: expiresAt,
    refreshTimer,
  });
}

/**
 * Cleanup token refresh timers
 */
function cleanupTokenRefresh(providerKey: string): void {
  const cached = tokenCache.get(providerKey);
  if (cached?.refreshTimer) {
    clearInterval(cached.refreshTimer);
    tokenCache.delete(providerKey);
  }
}

/**
 * Format usage bar for display
 */
function formatBar(limit: number, used: number, width = 16): string {
  if (!limit || limit <= 0) return "[no limit]";
  const pct = Math.max(0, Math.min(1, used / limit));
  const filled = Math.round(pct * width);
  return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
}

function formatPercent(limit: number, used: number): string {
  if (!limit || limit <= 0) return "n/a";
  const pct = Math.max(0, Math.min(100, (used / limit) * 100));
  return `${Math.round(pct)}%`;
}

/**
 * Parse integer safely
 */
function parseIntSafe(value: any): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Format usage message from API payload
 */
function formatUsageMessage(payload: any): string {
  const overall = payload?.usage || {};
  const detail = payload?.limits?.[0]?.detail || {};
  const user = payload?.user || {};

  const totalLimit = parseIntSafe(overall.limit);
  const totalUsed = parseIntSafe(overall.used);
  const totalRemaining = parseIntSafe(overall.remaining);
  const shortLimit = parseIntSafe(detail.limit);
  const shortUsed = parseIntSafe(detail.used);
  const shortRemaining = parseIntSafe(detail.remaining);

  const totalPct = formatPercent(totalLimit, totalUsed);
  const shortPct = formatPercent(shortLimit, shortUsed);

  return [
    "Kimi Usage",
    "",
    `Plan: ${user?.membership?.level || "unknown"}`,
    `7d:  ${formatBar(totalLimit, totalUsed)} ${totalPct} quota consumed (${totalUsed}/${totalLimit} units, ${totalRemaining} units left)`,
    `5h:  ${formatBar(shortLimit, shortUsed)} ${shortPct} quota consumed (${shortUsed}/${shortLimit} units, ${shortRemaining} units left)`,
    `7d reset: ${overall.resetTime || "unknown"}`,
    `5h reset: ${detail.resetTime || "unknown"}`,
  ].join("\n");
}

/**
 * Send status message to session
 */
async function sendStatusMessage(client: any, sessionID: string, text: string): Promise<void> {
  const bus = client?.bus;
  if (bus) {
    try {
      await bus.publish({
        topic: "companion.projection",
        body: { key: "kimi-usage", kind: "markdown", content: text },
      });
    } catch {
      // ignore bus projection failures
    }
  }

  await client.session.prompt({
    path: { id: sessionID },
    body: { noReply: true, parts: [{ type: "text", text, ignored: true }] },
  });
}

/**
 * Publish usage projection
 */
async function publishUsageProjection(client: any, text: string): Promise<void> {
  const bus = client?.bus;
  if (!bus) return;
  try {
    await bus.publish({
      topic: "companion.projection",
      body: { key: "kimi-usage", kind: "markdown", content: text },
    });
  } catch {
    // ignore projection failures
  }
}

/**
 * Kimi system prompt to prepend to chat messages
 */
const KIMI_SYSTEM_PROMPT =
  "You are Kimi, an AI assistant created by Moonshot AI. You are helpful, harmless, and honest.";

export const KimiAuthPlugin: Plugin = async ({ client }: PluginInput): Promise<Hooks> => {
  let lastProjectionAt = 0;
  let projectionInFlight = false;
  let latestClientOAuth: OAuthCredentials | null = null;

  /**
   * Load OAuth credentials from OpenCode auth or encrypted token file
   */
  async function loadOAuthCredentials(): Promise<
    | { source: "client"; creds: OAuthCredentials }
    | { source: "file"; creds: OAuthCredentials }
    | { source: "none"; creds: null }
  > {
    const fromClient = await readOAuthCredentialsFromClient(client, "kimi-for-coding");
    if (fromClient) {
      if (latestClientOAuth && latestClientOAuth.expires > fromClient.expires) {
        return { source: "client", creds: latestClientOAuth };
      }
      latestClientOAuth = fromClient;
      return { source: "client", creds: fromClient };
    }

    if (latestClientOAuth && latestClientOAuth.expires > Math.floor(Date.now() / 1000)) {
      return { source: "client", creds: latestClientOAuth };
    }

    const token = await getToken();
    if (!token?.access_token || !token?.refresh_token) {
      return { source: "none", creds: null };
    }

    return {
      source: "file",
      creds: {
        type: "oauth",
        access: token.access_token,
        refresh: token.refresh_token,
        expires: Math.floor(Date.now() / 1000) + Math.max(token.expires_in || 0, 0),
      },
    };
  }

  /**
   * Get fresh OAuth access token (with auto-refresh)
   */
  async function getFreshOAuthAccessToken(): Promise<{ ok: boolean; accessToken?: string; error?: string }> {
    const { source, creds } = await loadOAuthCredentials();
    if (!creds) {
      return { ok: false, error: "No Kimi OAuth credentials found. Run /auth for kimi-for-coding." };
    }

    let accessToken = creds.access;
    let refreshTokenStr = creds.refresh;
    let expiresAt = creds.expires;
    const now = Math.floor(Date.now() / 1000);

    if (expiresAt <= now + EXPIRY_THRESHOLD_S && refreshTokenStr) {
      try {
        const refreshed = await refreshToken(refreshTokenStr);
        accessToken = refreshed.access_token;
        refreshTokenStr = refreshed.refresh_token || refreshTokenStr;
        expiresAt = now + refreshed.expires_in;
        if (source === "client") {
          latestClientOAuth = {
            type: "oauth",
            access: accessToken,
            refresh: refreshTokenStr,
            expires: expiresAt,
          };
        }
        await storeToken(refreshed);
      } catch (error) {
        return { ok: false, error: `Token refresh failed: ${String(error)}` };
      }
    }

    return { ok: true, accessToken };
  }

  /**
   * Fetch Kimi usage payload
   */
  async function fetchKimiUsagePayload(): Promise<{ ok: boolean; payload?: any; error?: string }> {
    const tokenResult = await getFreshOAuthAccessToken();
    if (!tokenResult.ok) return tokenResult;

    try {
      const response = await fetch(KIMI_USAGE_URL, {
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
          "x-api-key": tokenResult.accessToken!,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        return { ok: false, error: `Request failed (${response.status}).\n${body.slice(0, 300)}` };
      }

      const payload = await response.json();
      return { ok: true, payload };
    } catch (error) {
      return { ok: false, error: `Failed to fetch usage: ${String(error)}` };
    }
  }

  /**
   * Refresh usage projection if due
   */
  async function refreshProjectionIfDue(force = false): Promise<void> {
    const nowMs = Date.now();
    if (!force && nowMs - lastProjectionAt < PROJECTION_REFRESH_MS) return;
    if (projectionInFlight) return;
    projectionInFlight = true;
    try {
      const usage = await fetchKimiUsagePayload();
      if (!usage.ok) return;
      await publishUsageProjection(client, formatUsageMessage(usage.payload));
      lastProjectionAt = Date.now();
    } finally {
      projectionInFlight = false;
    }
  }

  /**
   * Refresh cached token if needed
   */
  async function refreshCachedToken(providerKey: string): Promise<any> {
    const cached = tokenCache.get(providerKey);
    if (!cached) return null;
    const now = Math.floor(Date.now() / 1000);
    if (cached.expires > now + EXPIRY_THRESHOLD_S) {
      return cached;
    }
    try {
      const refreshed = await refreshToken(cached.refresh);
      const next = {
        access: refreshed.access_token,
        refresh: refreshed.refresh_token || cached.refresh,
        expires: now + refreshed.expires_in,
        refreshTimer: cached.refreshTimer,
      };
      tokenCache.set(providerKey, next);
      await storeToken(refreshed);
      return next;
    } catch (error) {
      console.error("Failed to refresh cached Kimi token:", error);
      return cached;
    }
  }

  return {
    event: async ({ event }) => {
      if (event?.type === "session.created" || event?.type === "session.updated" || event?.type === "session.idle") {
        await refreshProjectionIfDue();
      }
    },
    config: async (input) => {
      input.command ??= {};
      input.command["kimi-usage"] = {
        template: "/kimi-usage",
        description: "Show Kimi quota usage and reset times",
      };
    },
    "command.execute.before": async (input, _output) => {
      if (input.command !== "kimi-usage") return;

      const usage = await fetchKimiUsagePayload();
      if (!usage.ok) {
        await sendStatusMessage(client, input.sessionID, `Kimi Usage\n\n${usage.error}`);
        throw new Error(KIMI_USAGE_HANDLED_ERROR);
      }

      const text = formatUsageMessage(usage.payload);
      await sendStatusMessage(client, input.sessionID, text);
      await publishUsageProjection(client, text);
      lastProjectionAt = Date.now();

      throw new Error(KIMI_USAGE_HANDLED_ERROR);
    },
    auth: {
      provider: "kimi-for-coding",
      loader: async (auth: () => Promise<Auth>) => {
        const credentials = await auth();
        const providerKey = "kimi-for-coding";

        if (credentials.type === "oauth") {
          let accessToken = credentials.access;
          let refreshTokenStr = credentials.refresh;
          let expiresAt = credentials.expires;

          if (!accessToken || !refreshTokenStr || !Number.isFinite(expiresAt)) {
            const localToken = await getToken();
            if (!localToken?.access_token || !localToken?.refresh_token) {
              throw new Error("Missing OAuth credentials for Kimi provider");
            }
            accessToken = localToken.access_token;
            refreshTokenStr = localToken.refresh_token;
            expiresAt = Math.floor(Date.now() / 1000) + Math.max(localToken.expires_in || 0, 0);
          }

          const now = Math.floor(Date.now() / 1000);

          if (expiresAt <= now + EXPIRY_THRESHOLD_S) {
            try {
              const refreshed = await refreshToken(refreshTokenStr);
              accessToken = refreshed.access_token;
              refreshTokenStr = refreshed.refresh_token || refreshTokenStr;
              expiresAt = now + refreshed.expires_in;
              await storeToken(refreshed);
            } catch (error) {
              console.error("Failed to refresh Kimi token before request:", error);
            }
          }

          latestClientOAuth = {
            type: "oauth",
            access: accessToken,
            refresh: refreshTokenStr,
            expires: expiresAt,
          };

          startTokenRefresh(providerKey, accessToken, refreshTokenStr, expiresAt);
          const cached = tokenCache.get(providerKey);
          const authToken = cached?.access || accessToken;

          // Return Anthropic SDK compatible format
          return {
            apiKey: authToken,
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
            fetch: async (input: string | URL | Request, init?: RequestInit) => {
              const live = (await refreshCachedToken(providerKey)) || tokenCache.get(providerKey);
              const liveToken = live?.access || authToken;
              const headers = new Headers(init?.headers || {});
              headers.set("x-api-key", liveToken);
              headers.set("Authorization", `Bearer ${liveToken}`);
              return fetch(input, {
                ...init,
                headers,
              });
            },
          };
        }

        if (credentials.type === "api") {
          return {
            apiKey: credentials.key,
            headers: {
              Authorization: `Bearer ${credentials.key}`,
            },
          };
        }

        if (credentials.type === "wellknown") {
          return {
            apiKey: credentials.token,
            headers: {
              Authorization: `Bearer ${credentials.token}`,
            },
          };
        }

        throw new Error("Unsupported authentication type for Kimi provider");
      },
      methods: [
        {
          type: "oauth",
          label: "Kimi Code Subscription",
          authorize: async () => {
            const deviceAuth = await requestDeviceAuthorization();
            return {
              url: deviceAuth.verification_uri_complete || deviceAuth.verification_uri,
              instructions: `Enter code: ${deviceAuth.user_code}`,
              method: "auto",
              callback: async () => {
                try {
                  const token = await pollForToken(deviceAuth.device_code, {
                    pollInterval: (deviceAuth.interval || 5) * 1000,
                  });
                  const providerKeyInner = "kimi-for-coding";
                  cleanupTokenRefresh(providerKeyInner);
                  return {
                    type: "success" as const,
                    provider: "kimi-for-coding",
                    access: token.access_token,
                    refresh: token.refresh_token,
                    expires: Math.floor(Date.now() / 1000) + token.expires_in,
                  };
                } catch (error) {
                  console.error("OAuth authorization failed:", error);
                  return { type: "failed" as const };
                }
              },
            };
          },
        },
        {
          type: "api",
          label: "API Key",
          prompts: [
            {
              type: "text",
              key: "apiKey",
              message: "Enter your Kimi API key:",
              placeholder: "kimi-api-...",
              validate: (value: string) => {
                if (!value || value.trim() === "") {
                  return "API key is required";
                }
                if (!value.startsWith("kimi-api-")) {
                  return "Invalid API key format. Should start with 'kimi-api-'";
                }
                return undefined;
              },
            },
          ],
          authorize: async (inputs?: Record<string, string>) => {
            const apiKey = inputs?.apiKey;
            if (!apiKey || apiKey.trim() === "") {
              return { type: "failed" as const };
            }
            try {
              const response = await fetch(`${KIMI_API_BASE_URL}/models`, {
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                },
              });
              if (!response.ok) {
                return { type: "failed" as const };
              }
              return {
                type: "success" as const,
                provider: "kimi-for-coding",
                key: apiKey,
              };
            } catch {
              return { type: "failed" as const };
            }
          },
        },
      ],
    },
    "experimental.chat.system.transform": async (_input, output) => {
      if (!output.system) {
        output.system = [];
      }
      output.system.unshift(KIMI_SYSTEM_PROMPT);
    },
  };
};

export default KimiAuthPlugin;
