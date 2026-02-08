// src/provider/cognito.ts
import { Oauth2Provider } from "./oauth2.js";
function CognitoProvider(config) {
  const domain = `${config.domain}.auth.${config.region}.amazoncognito.com`;
  return Oauth2Provider({
    type: "cognito",
    ...config,
    endpoint: {
      authorization: `https://${domain}/oauth2/authorize`,
      token: `https://${domain}/oauth2/token`
    }
  });
}
export {
  CognitoProvider
};
