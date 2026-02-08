// src/provider/keycloak.ts
import { Oauth2Provider } from "./oauth2.js";
function KeycloakProvider(config) {
  const baseConfig = {
    ...config,
    endpoint: {
      authorization: `${config.baseUrl}/realms/${config.realm}/protocol/openid-connect/auth`,
      token: `${config.baseUrl}/realms/${config.realm}/protocol/openid-connect/token`
    }
  };
  return Oauth2Provider(baseConfig);
}
export {
  KeycloakProvider
};
