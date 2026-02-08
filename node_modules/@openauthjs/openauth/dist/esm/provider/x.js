// src/provider/x.ts
import { Oauth2Provider } from "./oauth2.js";
function XProvider(config) {
  return Oauth2Provider({
    ...config,
    type: "x",
    endpoint: {
      authorization: "https://twitter.com/i/oauth2/authorize",
      token: "https://api.x.com/2/oauth2/token"
    },
    pkce: true
  });
}
export {
  XProvider
};
