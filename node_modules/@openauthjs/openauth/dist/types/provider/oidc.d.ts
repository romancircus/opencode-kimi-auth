/**
 * Use this to connect authentication providers that support OIDC.
 *
 * ```ts {5-8}
 * import { OidcProvider } from "@openauthjs/openauth/provider/oidc"
 *
 * export default issuer({
 *   providers: {
 *     oauth2: OidcProvider({
 *       clientId: "1234567890",
 *       issuer: "https://auth.myserver.com"
 *     })
 *   }
 * })
 * ```
 *
 *
 * @packageDocumentation
 */
import { Provider } from "./provider.js";
import { JWTPayload } from "hono/utils/jwt/types";
export interface OidcConfig {
    /**
     * @internal
     */
    type?: string;
    /**
     * The client ID.
     *
     * This is just a string to identify your app.
     *
     * @example
     * ```ts
     * {
     *   clientID: "my-client"
     * }
     * ```
     */
    clientID: string;
    /**
     * The URL of your authorization server.
     *
     * @example
     * ```ts
     * {
     *   issuer: "https://auth.myserver.com"
     * }
     * ```
     */
    issuer: string;
    /**
     * A list of OIDC scopes that you want to request.
     *
     * @example
     * ```ts
     * {
     *   scopes: ["openid", "profile", "email"]
     * }
     * ```
     */
    scopes?: string[];
    /**
     * Any additional parameters that you want to pass to the authorization endpoint.
     * @example
     * ```ts
     * {
     *   query: {
     *     prompt: "consent"
     *   }
     * }
     * ```
     */
    query?: Record<string, string>;
}
/**
 * @internal
 */
export type OidcWrappedConfig = Omit<OidcConfig, "issuer" | "name">;
/**
 * @internal
 */
export interface IdTokenResponse {
    idToken: string;
    claims: Record<string, any>;
    raw: Record<string, any>;
}
export declare function OidcProvider(config: OidcConfig): Provider<{
    id: JWTPayload;
    clientID: string;
}>;
//# sourceMappingURL=oidc.d.ts.map