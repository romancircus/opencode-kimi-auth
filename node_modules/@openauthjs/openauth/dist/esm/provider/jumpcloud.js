// src/provider/jumpcloud.ts
import { Oauth2Provider } from "./oauth2.js";
function JumpCloudProvider(config) {
  return Oauth2Provider({
    type: "jumpcloud",
    ...config,
    endpoint: {
      authorization: "https://oauth.id.jumpcloud.com/oauth2/auth",
      token: "https://oauth.id.jumpcloud.com/oauth2/token"
    }
  });
}
export {
  JumpCloudProvider
};
