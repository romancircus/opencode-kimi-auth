// src/provider/apple.ts
import { Oauth2Provider } from "./oauth2.js";
import { OidcProvider } from "./oidc.js";
function AppleProvider(config) {
  return Oauth2Provider({
    ...config,
    type: "apple",
    endpoint: {
      authorization: "https://appleid.apple.com/auth/authorize",
      token: "https://appleid.apple.com/auth/token"
    }
  });
}
function AppleOidcProvider(config) {
  return OidcProvider({
    ...config,
    type: "apple",
    issuer: "https://appleid.apple.com"
  });
}
export {
  AppleProvider,
  AppleOidcProvider
};
