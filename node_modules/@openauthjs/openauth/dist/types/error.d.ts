/**
 * A list of errors that can be thrown by OpenAuth.
 *
 * You can use these errors to check the type of error and handle it. For example.
 *
 * ```ts
 * import { InvalidAuthorizationCodeError } from "@openauthjs/openauth/error"
 *
 * if (err instanceof InvalidAuthorizationCodeError) {
 *   // handle invalid code error
 * }
 * ```
 *
 * @packageDocumentation
 */
/**
 * The OAuth server returned an error.
 */
export declare class OauthError extends Error {
    error: "invalid_request" | "invalid_grant" | "unauthorized_client" | "access_denied" | "unsupported_grant_type" | "server_error" | "temporarily_unavailable";
    description: string;
    constructor(error: "invalid_request" | "invalid_grant" | "unauthorized_client" | "access_denied" | "unsupported_grant_type" | "server_error" | "temporarily_unavailable", description: string);
}
/**
 * The `provider` needs to be passed in.
 */
export declare class MissingProviderError extends OauthError {
    constructor();
}
/**
 * The given parameter is missing.
 */
export declare class MissingParameterError extends OauthError {
    parameter: string;
    constructor(parameter: string);
}
/**
 * The given client is not authorized to use the redirect URI that was passed in.
 */
export declare class UnauthorizedClientError extends OauthError {
    clientID: string;
    constructor(clientID: string, redirectURI: string);
}
/**
 * The browser was in an unknown state.
 *
 * This can happen when certain cookies have expired. Or the browser was switched in the middle
 * of the authentication flow.
 */
export declare class UnknownStateError extends Error {
    constructor();
}
/**
 * The given subject is invalid.
 */
export declare class InvalidSubjectError extends Error {
    constructor();
}
/**
 * The given refresh token is invalid.
 */
export declare class InvalidRefreshTokenError extends Error {
    constructor();
}
/**
 * The given access token is invalid.
 */
export declare class InvalidAccessTokenError extends Error {
    constructor();
}
/**
 * The given authorization code is invalid.
 */
export declare class InvalidAuthorizationCodeError extends Error {
    constructor();
}
//# sourceMappingURL=error.d.ts.map