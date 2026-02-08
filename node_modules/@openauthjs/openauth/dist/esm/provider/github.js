// src/provider/github.ts
import { Oauth2Provider } from "./oauth2.js";
function GithubProvider(config) {
  return Oauth2Provider({
    ...config,
    type: "github",
    endpoint: {
      authorization: "https://github.com/login/oauth/authorize",
      token: "https://github.com/login/oauth/access_token"
    }
  });
}
export {
  GithubProvider
};
