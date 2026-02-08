import { Provider } from "./provider.js";
import { v1 } from "@standard-schema/spec";
/**
 * @internal
 */
export interface PasswordHasher<T> {
    hash(password: string): Promise<T>;
    verify(password: string, compare: T): Promise<boolean>;
}
export interface PasswordConfig {
    /**
     * @internal
     */
    length?: number;
    /**
     * @internal
     */
    hasher?: PasswordHasher<any>;
    /**
     * The request handler to generate the UI for the login screen.
     *
     * Takes the standard [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
     * and optionally [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
     * ojects.
     *
     * In case of an error, this is called again with the `error`.
     *
     * Expects the [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) object
     * in return.
     */
    login: (req: Request, form?: FormData, error?: PasswordLoginError) => Promise<Response>;
    /**
     * The request handler to generate the UI for the register screen.
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
    register: (req: Request, state: PasswordRegisterState, form?: FormData, error?: PasswordRegisterError) => Promise<Response>;
    /**
     * The request handler to generate the UI for the change password screen.
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
    change: (req: Request, state: PasswordChangeState, form?: FormData, error?: PasswordChangeError) => Promise<Response>;
    /**
     * Callback to send the confirmation pin code to the user.
     *
     * @example
     * ```ts
     * {
     *   sendCode: async (email, code) => {
     *     // Send an email with the code
     *   }
     * }
     * ```
     */
    sendCode: (email: string, code: string) => Promise<void>;
    /**
     * Callback to validate the password on sign up and password reset.
     *
     * @example
     * ```ts
     * {
     *   validatePassword: (password) => {
     *      return password.length < 8 ? "Password must be at least 8 characters" : undefined
     *   }
     * }
     * ```
     */
    validatePassword?: v1.StandardSchema | ((password: string) => Promise<string | undefined> | string | undefined);
}
/**
 * The states that can happen on the register screen.
 *
 * | State | Description |
 * | ----- | ----------- |
 * | `start` | The user is asked to enter their email address and password to start the flow. |
 * | `code` | The user needs to enter the pin code to verify their email. |
 */
export type PasswordRegisterState = {
    type: "start";
} | {
    type: "code";
    code: string;
    email: string;
    password: string;
};
/**
 * The errors that can happen on the register screen.
 *
 * | Error | Description |
 * | ----- | ----------- |
 * | `email_taken` | The email is already taken. |
 * | `invalid_email` | The email is invalid. |
 * | `invalid_code` | The code is invalid. |
 * | `invalid_password` | The password is invalid. |
 * | `password_mismatch` | The passwords do not match. |
 */
export type PasswordRegisterError = {
    type: "invalid_code";
} | {
    type: "email_taken";
} | {
    type: "invalid_email";
} | {
    type: "invalid_password";
} | {
    type: "password_mismatch";
} | {
    type: "validation_error";
    message?: string;
};
/**
 * The state of the password change flow.
 *
 * | State | Description |
 * | ----- | ----------- |
 * | `start` | The user is asked to enter their email address to start the flow. |
 * | `code` | The user needs to enter the pin code to verify their email. |
 * | `update` | The user is asked to enter their new password and confirm it. |
 */
export type PasswordChangeState = {
    type: "start";
    redirect: string;
} | {
    type: "code";
    code: string;
    email: string;
    redirect: string;
} | {
    type: "update";
    redirect: string;
    email: string;
};
/**
 * The errors that can happen on the change password screen.
 *
 * | Error | Description |
 * | ----- | ----------- |
 * | `invalid_email` | The email is invalid. |
 * | `invalid_code` | The code is invalid. |
 * | `invalid_password` | The password is invalid. |
 * | `password_mismatch` | The passwords do not match. |
 */
export type PasswordChangeError = {
    type: "invalid_email";
} | {
    type: "invalid_code";
} | {
    type: "invalid_password";
} | {
    type: "password_mismatch";
} | {
    type: "validation_error";
    message: string;
};
/**
 * The errors that can happen on the login screen.
 *
 * | Error | Description |
 * | ----- | ----------- |
 * | `invalid_email` | The email is invalid. |
 * | `invalid_password` | The password is invalid. |
 */
export type PasswordLoginError = {
    type: "invalid_password";
} | {
    type: "invalid_email";
};
export declare function PasswordProvider(config: PasswordConfig): Provider<{
    email: string;
}>;
/**
 * @internal
 */
export declare function PBKDF2Hasher(opts?: {
    iterations?: number;
}): PasswordHasher<{
    hash: string;
    salt: string;
    iterations: number;
}>;
/**
 * @internal
 */
export declare function ScryptHasher(opts?: {
    N?: number;
    r?: number;
    p?: number;
}): PasswordHasher<{
    hash: string;
    salt: string;
    N: number;
    r: number;
    p: number;
}>;
//# sourceMappingURL=password.d.ts.map