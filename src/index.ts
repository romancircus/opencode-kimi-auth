import type { Auth, Hooks, Plugin, PluginInput } from "./types.js";
import {
  requestDeviceAuthorization,
  pollForToken,
  refreshToken,
  storeToken,
  getToken,
  clearCredentials,
} from "./oauth.js";

const KIMI_API_BASE_URL = "https://kimi.com/api/v1";
const REFRESH_INTERVAL_MS = 60 * 1000; // 60 seconds
const EXPIRY_THRESHOLD_S = 300; // 300 seconds before expiry

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

/**
 * Start automatic token refresh for a cached token
 */
function startTokenRefresh(
  providerKey: string,
  refreshTokenStr: string,
  expiresIn: number,
): void {
  const existing = tokenCache.get(providerKey);
  if (existing?.refreshTimer) {
    clearInterval(existing.refreshTimer);
  }

  const refreshTimer = setInterval(async () => {
    const cached = tokenCache.get(providerKey);
    if (!cached) return;

    const timeUntilExpiry = cached.expires - Math.floor(Date.now() / 1000);

    // Refresh if within threshold
    if (timeUntilExpiry <= EXPIRY_THRESHOLD_S) {
      try {
        const newToken = await refreshToken(cached.refresh);
        tokenCache.set(providerKey, {
          access: newToken.access_token,
          refresh: newToken.refresh_token,
          expires: Math.floor(Date.now() / 1000) + newToken.expires_in,
          refreshTimer,
        });
        // Update stored token
        await storeToken(newToken);
      } catch (error) {
        console.error("Failed to refresh Kimi token:", error);
        // Token will be retried on next interval
      }
    }
  }, REFRESH_INTERVAL_MS);

  tokenCache.set(providerKey, {
    access: existing?.access || "",
    refresh: refreshTokenStr,
    expires: Math.floor(Date.now() / 1000) + expiresIn,
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
 * Kimi system prompt to prepend to chat messages
 */
const KIMI_SYSTEM_PROMPT = `You are Kimi, an AI assistant created by Moonshot AI. You are helpful, harmless, and honest.`;

export const KimiAuthPlugin: Plugin = async (_input: PluginInput): Promise<Hooks> => {
  return {
    auth: {
      provider: "kimi",
      loader: async (auth: () => Promise<Auth>) => {
        const credentials = await auth();
        const providerKey = "kimi";

        if (credentials.type === "oauth") {
          // Start automatic refresh for OAuth tokens
          startTokenRefresh(providerKey, credentials.refresh, credentials.expires);

          return {
            Authorization: `Bearer ${credentials.access}`,
          };
        }

        if (credentials.type === "api") {
          return {
            Authorization: `Bearer ${credentials.key}`,
          };
        }

        if (credentials.type === "wellknown") {
          return {
            Authorization: `Bearer ${credentials.token}`,
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
                  const token = await pollForToken(
                    deviceAuth.device_code,
                    {
                      pollInterval: (deviceAuth.interval || 5) * 1000,
                    },
                  );

                  const providerKey = "kimi";
                  cleanupTokenRefresh(providerKey);

                  return {
                    type: "success" as const,
                    provider: "kimi",
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

            // Validate the API key with a simple request
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
                provider: "kimi",
                key: apiKey,
              };
            } catch {
              return { type: "failed" as const };
            }
          },
        },
      ],
    },

    "experimental.chat.system.transform": async (
      _input: Record<string, never>,
      output: { system: string[] },
    ) => {
      // Prepend Kimi system prompt to the system messages
      if (!output.system) {
        output.system = [];
      }
      output.system.unshift(KIMI_SYSTEM_PROMPT);
    },
  };
};

export default KimiAuthPlugin;
