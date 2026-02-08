// src/provider/yahoo.ts
import { Oauth2Provider } from "./oauth2.js";
function YahooProvider(config) {
  return Oauth2Provider({
    ...config,
    type: "yahoo",
    endpoint: {
      authorization: "https://api.login.yahoo.com/oauth2/request_auth",
      token: "https://api.login.yahoo.com/oauth2/get_token"
    }
  });
}
export {
  YahooProvider
};
