/**
 * The UI that's displayed when loading the root page of the OpenAuth server. You can configure
 * which providers should be displayed in the select UI.
 *
 * ```ts
 * import { Select } from "@openauthjs/openauth/ui/select"
 *
 * export default issuer({
 *   select: Select({
 *     providers: {
 *       github: {
 *         hide: true
 *       },
 *       google: {
 *         display: "Google"
 *       }
 *     }
 *   })
 *   // ...
 * })
 * ```
 *
 * @packageDocumentation
 */
/** @jsxImportSource hono/jsx */
export interface SelectProps {
    /**
     * An object with all the providers and their config; where the key is the provider name.
     *
     * @example
     * ```ts
     * {
     *   github: {
     *     hide: true
     *   },
     *   google: {
     *     display: "Google"
     *   }
     * }
     * ```
     */
    providers?: Record<string, {
        /**
         * Whether to hide the provider from the select UI.
         * @default false
         */
        hide?: boolean;
        /**
         * The display name of the provider.
         */
        display?: string;
    }>;
}
export declare function Select(props?: SelectProps): (providers: Record<string, string>, _req: Request) => Promise<Response>;
//# sourceMappingURL=select.d.ts.map