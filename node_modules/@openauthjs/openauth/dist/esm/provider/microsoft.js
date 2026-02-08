// src/provider/microsoft.ts
import { Oauth2Provider } from "./oauth2.js";
import { OidcProvider } from "./oidc.js";
function MicrosoftProvider(config) {
  return Oauth2Provider({
    ...config,
    type: "microsoft",
    endpoint: {
      authorization: `https://login.microsoftonline.com/${config?.tenant}/oauth2/v2.0/authorize`,
      token: `https://login.microsoftonline.com/${config?.tenant}/oauth2/v2.0/token`
    }
  });
}
function MicrosoftOidcProvider(config) {
  return OidcProvider({
    ...config,
    type: "microsoft",
    issuer: "https://graph.microsoft.com/oidc/userinfo"
  });
}
export {
  MicrosoftProvider,
  MicrosoftOidcProvider
};
