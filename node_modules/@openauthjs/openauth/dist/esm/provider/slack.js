// src/provider/slack.ts
import { Oauth2Provider } from "./oauth2.js";
function SlackProvider(config) {
  return Oauth2Provider({
    ...config,
    type: "slack",
    endpoint: {
      authorization: "https://slack.com/openid/connect/authorize",
      token: "https://slack.com/api/openid.connect.token"
    }
  });
}
export {
  SlackProvider
};
