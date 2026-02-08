/**
 * Configure the UI that's used by the Password provider.
 *
 * ```ts {1,7-12}
 * import { PasswordUI } from "@openauthjs/openauth/ui/password"
 * import { PasswordProvider } from "@openauthjs/openauth/provider/password"
 *
 * export default issuer({
 *   providers: {
 *     password: PasswordAdapter(
 *       PasswordUI({
 *         copy: {
 *           error_email_taken: "This email is already taken."
 *         },
 *         sendCode: (email, code) => console.log(email, code)
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
import { PasswordConfig } from "../provider/password.js";
import "./form.js";
declare const DEFAULT_COPY: {
    /**
     * Error message when email is already taken.
     */
    error_email_taken: string;
    /**
     * Error message when the confirmation code is incorrect.
     */
    error_invalid_code: string;
    /**
     * Error message when the email is invalid.
     */
    error_invalid_email: string;
    /**
     * Error message when the password is incorrect.
     */
    error_invalid_password: string;
    /**
     * Error message when the passwords do not match.
     */
    error_password_mismatch: string;
    /**
     * Error message when the user enters a password that fails validation.
     */
    error_validation_error: string;
    /**
     * Title of the register page.
     */
    register_title: string;
    /**
     * Description of the register page.
     */
    register_description: string;
    /**
     * Title of the login page.
     */
    login_title: string;
    /**
     * Description of the login page.
     */
    login_description: string;
    /**
     * Copy for the register button.
     */
    register: string;
    /**
     * Copy for the register link.
     */
    register_prompt: string;
    /**
     * Copy for the login link.
     */
    login_prompt: string;
    /**
     * Copy for the login button.
     */
    login: string;
    /**
     * Copy for the forgot password link.
     */
    change_prompt: string;
    /**
     * Copy for the resend code button.
     */
    code_resend: string;
    /**
     * Copy for the "Back to" link.
     */
    code_return: string;
    /**
     * Copy for the logo.
     * @internal
     */
    logo: string;
    /**
     * Copy for the email input.
     */
    input_email: string;
    /**
     * Copy for the password input.
     */
    input_password: string;
    /**
     * Copy for the code input.
     */
    input_code: string;
    /**
     * Copy for the repeat password input.
     */
    input_repeat: string;
    /**
     * Copy for the continue button.
     */
    button_continue: string;
};
type PasswordUICopy = typeof DEFAULT_COPY;
/**
 * Configure the password UI.
 */
export interface PasswordUIOptions extends Pick<PasswordConfig, "sendCode" | "validatePassword"> {
    /**
     * Custom copy for the UI.
     */
    copy?: Partial<PasswordUICopy>;
}
/**
 * Creates a UI for the Password provider flow.
 * @param input - Configure the UI.
 */
export declare function PasswordUI(input: PasswordUIOptions): PasswordConfig;
export {};
//# sourceMappingURL=password.d.ts.map