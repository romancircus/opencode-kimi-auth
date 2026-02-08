import type { OAuth2Tokens } from "arctic";
import { Provider } from "./provider.js";
export interface ArcticProviderOptions {
    scopes: string[];
    clientID: string;
    clientSecret: string;
    query?: Record<string, string>;
}
export declare function ArcticProvider(provider: new (clientID: string, clientSecret: string, callback: string) => {
    createAuthorizationURL(state: string, scopes: string[]): URL;
    validateAuthorizationCode(code: string): Promise<OAuth2Tokens>;
    refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens>;
}, config: ArcticProviderOptions): Provider<{
    tokenset: OAuth2Tokens;
}>;
//# sourceMappingURL=arctic.d.ts.map