// src/provider/discord.ts
import { Oauth2Provider } from "./oauth2.js";
function DiscordProvider(config) {
  return Oauth2Provider({
    type: "discord",
    ...config,
    endpoint: {
      authorization: "https://discord.com/oauth2/authorize",
      token: "https://discord.com/api/oauth2/token"
    }
  });
}
export {
  DiscordProvider
};
