// src/provider/google.ts
import { Oauth2Provider } from "./oauth2.js";
import { OidcProvider } from "./oidc.js";
function GoogleProvider(config) {
  return Oauth2Provider({
    ...config,
    type: "google",
    endpoint: {
      authorization: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token"
    }
  });
}
function GoogleOidcProvider(config) {
  return OidcProvider({
    ...config,
    type: "google",
    issuer: "https://accounts.google.com"
  });
}
export {
  GoogleProvider,
  GoogleOidcProvider
};
