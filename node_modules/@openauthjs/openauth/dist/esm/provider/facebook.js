// src/provider/facebook.ts
import { Oauth2Provider } from "./oauth2.js";
import { OidcProvider } from "./oidc.js";
function FacebookProvider(config) {
  return Oauth2Provider({
    ...config,
    type: "facebook",
    endpoint: {
      authorization: "https://www.facebook.com/v12.0/dialog/oauth",
      token: "https://graph.facebook.com/v12.0/oauth/access_token"
    }
  });
}
function FacebookOidcProvider(config) {
  return OidcProvider({
    ...config,
    type: "facebook",
    issuer: "https://graph.facebook.com"
  });
}
export {
  FacebookProvider,
  FacebookOidcProvider
};
