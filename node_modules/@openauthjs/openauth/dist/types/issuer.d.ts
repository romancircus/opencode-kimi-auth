/**
 * The `issuer` create an OpentAuth server, a [Hono](https://hono.dev) app that's
 * designed to run anywhere.
 *
 * The `issuer` function requires a few things:
 *
 * ```ts title="issuer.ts"
 * import { issuer } from "@openauthjs/openauth"
 *
 * const app = issuer({
 *   providers: { ... },
 *   storage,
 *   subjects,
 *   success: async (ctx, value) => { ... }
 * })
 * ```
 *
 * #### Add providers
 *
 * You start by specifying the auth providers you are going to use. Let's say you want your users
 * to be able to authenticate with GitHub and with their email and password.
 *
 * ```ts title="issuer.ts"
 * import { GithubProvider } from "@openauthjs/openauth/provider/github"
 * import { PasswordProvider } from "@openauthjs/openauth/provider/password"
 *
 * const app = issuer({
 *   providers: {
 *     github: GithubProvider({
 *       // ...
 *     }),
 *     password: PasswordProvider({
 *       // ...
 *     }),
 *   },
 * })
 * ```
 *
 * #### Handle success
 *
 * The `success` callback receives the payload when a user completes a provider's auth flow.
 *
 * ```ts title="issuer.ts"
 * const app = issuer({
 *   providers: { ... },
 *   subjects,
 *   async success(ctx, value) {
 *     let userID
 *     if (value.provider === "password") {
 *       console.log(value.email)
 *       userID = ... // lookup user or create them
 *     }
 *     if (value.provider === "github") {
 *       console.log(value.tokenset.access)
 *       userID = ... // lookup user or create them
 *     }
 *     return ctx.subject("user", {
 *       userID
 *     })
 *   }
 * })
 * ```
 *
 * Once complete, the `issuer` issues the access tokens that a client can use. The `ctx.subject`
 * call is what is placed in the access token as a JWT.
 *
 * #### Define subjects
 *
 * You define the shape of these in the `subjects` field.
 *
 * ```ts title="subjects.ts"
 * import { object, string } from "valibot"
 * import { createSubjects } from "@openauthjs/openauth/subject"
 *
 * const subjects = createSubjects({
 *   user: object({
 *     userID: string()
 *   })
 * })
 * ```
 *
 * It's good to place this in a separate file since this'll be used in your client apps as well.
 *
 * ```ts title="issuer.ts"
 * import { subjects } from "./subjects.js"
 *
 * const app = issuer({
 *   providers: { ... },
 *   subjects,
 *   // ...
 * })
 * ```
 *
 * #### Deploy
 *
 * Since `issuer` is a Hono app, you can deploy it anywhere Hono supports.
 *
 * <Tabs>
 *   <TabItem label="Node">
 *   ```ts title="issuer.ts"
 *   import { serve } from "@hono/node-server"
 *
 *   serve(app)
 *   ```
 *   </TabItem>
 *   <TabItem label="Lambda">
 *   ```ts title="issuer.ts"
 *   import { handle } from "hono/aws-lambda"
 *
 *   export const handler = handle(app)
 *   ```
 *   </TabItem>
 *   <TabItem label="Bun">
 *   ```ts title="issuer.ts"
 *   export default app
 *   ```
 *   </TabItem>
 *   <TabItem label="Workers">
 *   ```ts title="issuer.ts"
 *   export default app
 *   ```
 *   </TabItem>
 * </Tabs>
 *
 * @packageDocumentation
 */
import { Provider } from "./provider/provider.js";
import { SubjectPayload, SubjectSchema } from "./subject.js";
/**
 * Sets the subject payload in the JWT token and returns the response.
 *
 * ```ts
 * ctx.subject("user", {
 *   userID
 * })
 * ```
 */
export interface OnSuccessResponder<T extends {
    type: string;
    properties: any;
}> {
    /**
     * The `type` is the type of the subject, that was defined in the `subjects` field.
     *
     * The `properties` are the properties of the subject. This is the shape of the subject that
     * you defined in the `subjects` field.
     */
    subject<Type extends T["type"]>(type: Type, properties: Extract<T, {
        type: Type;
    }>["properties"], opts?: {
        ttl?: {
            access?: number;
            refresh?: number;
        };
        subject?: string;
    }): Promise<Response>;
}
/**
 * @internal
 */
export interface AuthorizationState {
    redirect_uri: string;
    response_type: string;
    state: string;
    client_id: string;
    audience?: string;
    pkce?: {
        challenge: string;
        method: "S256";
    };
}
/**
 * @internal
 */
export type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};
import { UnknownStateError } from "./error.js";
import { StorageAdapter } from "./storage/storage.js";
import { Theme } from "./ui/theme.js";
/** @internal */
export declare const aws: <E extends import("hono").Env = import("hono").Env, S extends import("hono").Schema = {}, BasePath extends string = "/">(app: import("hono").Hono<E, S, BasePath>) => ((event: import("hono/aws-lambda").LambdaEvent, lambdaContext?: import("hono/aws-lambda").LambdaContext) => Promise<import("hono/aws-lambda").APIGatewayProxyResult>);
export interface IssuerInput<Providers extends Record<string, Provider<any>>, Subjects extends SubjectSchema, Result = {
    [key in keyof Providers]: Prettify<{
        provider: key;
    } & (Providers[key] extends Provider<infer T> ? T : {})>;
}[keyof Providers]> {
    /**
     * The shape of the subjects that you want to return.
     *
     * @example
     *
     * ```ts title="issuer.ts"
     * import { object, string } from "valibot"
     * import { createSubjects } from "@openauthjs/openauth/subject"
     *
     * issuer({
     *   subjects: createSubjects({
     *     user: object({
     *       userID: string()
     *     })
     *   })
     *   // ...
     * })
     * ```
     */
    subjects: Subjects;
    /**
     * The storage adapter that you want to use.
     *
     * @example
     * ```ts title="issuer.ts"
     * import { DynamoStorage } from "@openauthjs/openauth/storage/dynamo"
     *
     * issuer({
     *   storage: DynamoStorage()
     *   // ...
     * })
     * ```
     */
    storage?: StorageAdapter;
    /**
     * The providers that you want your OpenAuth server to support.
     *
     * @example
     *
     * ```ts title="issuer.ts"
     * import { GithubProvider } from "@openauthjs/openauth/provider/github"
     *
     * issuer({
     *   providers: {
     *     github: GithubProvider()
     *   }
     * })
     * ```
     *
     * The key is just a string that you can use to identify the provider. It's passed back to
     * the `success` callback.
     *
     * You can also specify multiple providers.
     *
     * ```ts
     * {
     *   providers: {
     *     github: GithubProvider(),
     *     google: GoogleProvider()
     *   }
     * }
     * ```
     */
    providers: Providers;
    /**
     * The theme you want to use for the UI.
     *
     * This includes the UI the user sees when selecting a provider. And the `PasswordUI` and
     * `CodeUI` that are used by the `PasswordProvider` and `CodeProvider`.
     *
     * @example
     * ```ts title="issuer.ts"
     * import { THEME_SST } from "@openauthjs/openauth/ui/theme"
     *
     * issuer({
     *   theme: THEME_SST
     *   // ...
     * })
     * ```
     *
     * Or define your own.
     *
     * ```ts title="issuer.ts"
     * import type { Theme } from "@openauthjs/openauth/ui/theme"
     *
     * const MY_THEME: Theme = {
     *   // ...
     * }
     *
     * issuer({
     *   theme: MY_THEME
     *   // ...
     * })
     * ```
     */
    theme?: Theme;
    /**
     * Set the TTL, in seconds, for access and refresh tokens.
     *
     * @example
     * ```ts
     * {
     *   ttl: {
     *     access: 60 * 60 * 24 * 30,
     *     refresh: 60 * 60 * 24 * 365
     *   }
     * }
     * ```
     */
    ttl?: {
        /**
         * Interval in seconds where the access token is valid.
         * @default 30d
         */
        access?: number;
        /**
         * Interval in seconds where the refresh token is valid.
         * @default 1y
         */
        refresh?: number;
        /**
         * Interval in seconds where refresh token reuse is allowed. This helps mitigrate
         * concurrency issues.
         * @default 60s
         */
        reuse?: number;
        /**
         * Interval in seconds to retain refresh tokens for reuse detection.
         * @default 0s
         */
        retention?: number;
    };
    /**
     * Optionally, configure the UI that's displayed when the user visits the root URL of the
     * of the OpenAuth server.
     *
     * ```ts title="issuer.ts"
     * import { Select } from "@openauthjs/openauth/ui/select"
     *
     * issuer({
     *   select: Select({
     *     providers: {
     *       github: { hide: true },
     *       google: { display: "Google" }
     *     }
     *   })
     *   // ...
     * })
     * ```
     *
     * @default Select()
     */
    select?(providers: Record<string, string>, req: Request): Promise<Response>;
    /**
     * @internal
     */
    start?(req: Request): Promise<void>;
    /**
     * The success callback that's called when the user completes the flow.
     *
     * This is called after the user has been redirected back to your app after the OAuth flow.
     *
     * @example
     * ```ts
     * {
     *   success: async (ctx, value) => {
     *     let userID
     *     if (value.provider === "password") {
     *       console.log(value.email)
     *       userID = ... // lookup user or create them
     *     }
     *     if (value.provider === "github") {
     *       console.log(value.tokenset.access)
     *       userID = ... // lookup user or create them
     *     }
     *     return ctx.subject("user", {
     *       userID
     *     })
     *   },
     *   // ...
     * }
     * ```
     */
    success(response: OnSuccessResponder<SubjectPayload<Subjects>>, input: Result, req: Request): Promise<Response>;
    /**
     * @internal
     */
    error?(error: UnknownStateError, req: Request): Promise<Response>;
    /**
     * Override the logic for whether a client request is allowed to call the issuer.
     *
     * By default, it uses the following:
     *
     * - Allow if the `redirectURI` is localhost.
     * - Compare `redirectURI` to the request's hostname or the `x-forwarded-host` header. If they
     *   are from the same sub-domain level, then allow.
     *
     * @example
     * ```ts
     * {
     *   allow: async (input, req) => {
     *     // Allow all clients
     *     return true
     *   }
     * }
     * ```
     */
    allow?(input: {
        clientID: string;
        redirectURI: string;
        audience?: string;
    }, req: Request): Promise<boolean>;
}
/**
 * Create an OpenAuth server, a Hono app.
 */
export declare function issuer<Providers extends Record<string, Provider<any>>, Subjects extends SubjectSchema, Result = {
    [key in keyof Providers]: Prettify<{
        provider: key;
    } & (Providers[key] extends Provider<infer T> ? T : {})>;
}[keyof Providers]>(input: IssuerInput<Providers, Subjects, Result>): import("hono/hono-base").HonoBase<{
    Variables: {
        authorization: AuthorizationState;
    };
}, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=issuer.d.ts.map