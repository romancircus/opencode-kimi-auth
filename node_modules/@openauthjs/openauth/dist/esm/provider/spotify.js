// src/provider/spotify.ts
import { Oauth2Provider } from "./oauth2.js";
function SpotifyProvider(config) {
  return Oauth2Provider({
    ...config,
    type: "spotify",
    endpoint: {
      authorization: "https://accounts.spotify.com/authorize",
      token: "https://accounts.spotify.com/api/token"
    }
  });
}
export {
  SpotifyProvider
};
