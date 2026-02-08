/**
 * Configure the UI that's used by the Code provider.
 *
 * ```ts {1,7-12}
 * import { CodeUI } from "@openauthjs/openauth/ui/code"
 * import { CodeProvider } from "@openauthjs/openauth/provider/code"
 *
 * export default issuer({
 *   providers: {
 *     code: CodeAdapter(
 *       CodeUI({
 *         copy: {
 *           code_info: "We'll send a pin code to your email"
 *         },
 *         sendCode: (claims, code) => console.log(claims.email, code)
 *       })
 *     )
 *   },
 *   // ...
 * })
 * ```
 *
 * @packageDocumentation
 */
/** @jsxImportSource hono/jsx */
import { CodeProviderOptions } from "../provider/code.js";
declare const DEFAULT_COPY: {
    /**
     * Copy for the email input.
     */
    email_placeholder: string;
    /**
     * Error message when the email is invalid.
     */
    email_invalid: string;
    /**
     * Copy for the continue button.
     */
    button_continue: string;
    /**
     * Copy informing that the pin code will be emailed.
     */
    code_info: string;
    /**
     * Copy for the pin code input.
     */
    code_placeholder: string;
    /**
     * Error message when the code is invalid.
     */
    code_invalid: string;
    /**
     * Copy for when the code was sent.
     */
    code_sent: string;
    /**
     * Copy for when the code was resent.
     */
    code_resent: string;
    /**
     * Copy for the link to resend the code.
     */
    code_didnt_get: string;
    /**
     * Copy for the resend button.
     */
    code_resend: string;
};
export type CodeUICopy = typeof DEFAULT_COPY;
/**
 * Configure the password UI.
 */
export interface CodeUIOptions {
    /**
     * Callback to send the pin code to the user.
     *
     * The `claims` object contains the email or phone number of the user. You can send the code
     * using this.
     *
     * @example
     * ```ts
     * async (claims, code) => {
     *   // Send the code via the claim
     * }
     * ```
     */
    sendCode: (claims: Record<string, string>, code: string) => Promise<void>;
    /**
     * Custom copy for the UI.
     */
    copy?: Partial<CodeUICopy>;
    /**
     * The mode to use for the input.
     * @default "email"
     */
    mode?: "email" | "phone";
}
/**
 * Creates a UI for the Code provider flow.
 * @param props - Configure the UI.
 */
export declare function CodeUI(props: CodeUIOptions): CodeProviderOptions;
export {};
//# sourceMappingURL=code.d.ts.map