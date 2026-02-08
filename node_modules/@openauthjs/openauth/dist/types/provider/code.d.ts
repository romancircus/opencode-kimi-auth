import { Provider } from "./provider.js";
export interface CodeProviderConfig<Claims extends Record<string, string> = Record<string, string>> {
    /**
     * The length of the pin code.
     *
     * @default 6
     */
    length?: number;
    /**
     * The request handler to generate the UI for the code flow.
     *
     * Takes the standard [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
     * and optionally [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
     * ojects.
     *
     * Also passes in the current `state` of the flow and any `error` that occurred.
     *
     * Expects the [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) object
     * in return.
     */
    request: (req: Request, state: CodeProviderState, form?: FormData, error?: CodeProviderError) => Promise<Response>;
    /**
     * Callback to send the pin code to the user.
     *
     * @example
     * ```ts
     * {
     *   sendCode: async (claims, code) => {
     *     // Send the code through the email or phone number based on the claims
     *   }
     * }
     * ```
     */
    sendCode: (claims: Claims, code: string) => Promise<void | CodeProviderError>;
}
/**
 * The state of the code flow.
 *
 * | State | Description |
 * | ----- | ----------- |
 * | `start` | The user is asked to enter their email address or phone number to start the flow. |
 * | `code` | The user needs to enter the pin code to verify their _claim_. |
 */
export type CodeProviderState = {
    type: "start";
} | {
    type: "code";
    resend?: boolean;
    code: string;
    claims: Record<string, string>;
};
/**
 * The errors that can happen on the code flow.
 *
 * | Error | Description |
 * | ----- | ----------- |
 * | `invalid_code` | The code is invalid. |
 * | `invalid_claim` | The _claim_, email or phone number, is invalid. |
 */
export type CodeProviderError = {
    type: "invalid_code";
} | {
    type: "invalid_claim";
    key: string;
    value: string;
};
export declare function CodeProvider<Claims extends Record<string, string> = Record<string, string>>(config: CodeProviderConfig<Claims>): Provider<{
    claims: Claims;
}>;
/**
 * @internal
 */
export type CodeProviderOptions = Parameters<typeof CodeProvider>[0];
//# sourceMappingURL=code.d.ts.map