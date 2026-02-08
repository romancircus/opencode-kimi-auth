// src/provider/twitch.ts
import { Oauth2Provider } from "./oauth2.js";
function TwitchProvider(config) {
  return Oauth2Provider({
    type: "twitch",
    ...config,
    endpoint: {
      authorization: "https://id.twitch.tv/oauth2/authorize",
      token: "https://id.twitch.tv/oauth2/token"
    }
  });
}
export {
  TwitchProvider
};
