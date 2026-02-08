// src/provider/arctic.ts
import { OauthError } from "../error.js";
import { getRelativeUrl } from "../util.js";
function ArcticProvider(provider, config) {
  function getClient(c) {
    const callback = new URL(c.req.url);
    const pathname = callback.pathname.replace(/authorize.*$/, "callback");
    const url = getRelativeUrl(c, pathname);
    return new provider(config.clientID, config.clientSecret, url);
  }
  return {
    type: "arctic",
    init(routes, ctx) {
      routes.get("/authorize", async (c) => {
        const client = getClient(c);
        const state = crypto.randomUUID();
        await ctx.set(c, "provider", 60 * 10, {
          state
        });
        return c.redirect(client.createAuthorizationURL(state, config.scopes));
      });
      routes.get("/callback", async (c) => {
        const client = getClient(c);
        const provider2 = await ctx.get(c, "provider");
        if (!provider2)
          return c.redirect("../authorize");
        const code = c.req.query("code");
        const state = c.req.query("state");
        if (!code)
          throw new Error("Missing code");
        if (state !== provider2.state)
          throw new OauthError("invalid_request", "Invalid state");
        const tokens = await client.validateAuthorizationCode(code);
        return ctx.success(c, {
          tokenset: tokens
        });
      });
    }
  };
}
export {
  ArcticProvider
};
