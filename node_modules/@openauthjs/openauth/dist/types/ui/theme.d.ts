/**
 * Use one of the built-in themes.
 *
 * @example
 *
 * ```ts
 * import { THEME_SST } from "@openauthjs/openauth/ui/theme"
 *
 * export default issuer({
 *   theme: THEME_SST,
 *   // ...
 * })
 * ```
 *
 * Or define your own.
 *
 * ```ts
 * import type { Theme } from "@openauthjs/openauth/ui/theme"
 *
 * const MY_THEME: Theme = {
 *   title: "Acne",
 *   radius: "none",
 *   favicon: "https://www.example.com/favicon.svg",
 *   // ...
 * }
 *
 * export default issuer({
 *   theme: MY_THEME,
 *   // ...
 * })
 * ```
 *
 * @packageDocumentation
 */
/**
 * A type to define values for light and dark mode.
 *
 * @example
 * ```ts
 * {
 *   light: "#FFF",
 *   dark: "#000"
 * }
 * ```
 */
export interface ColorScheme {
    /**
     * The value for dark mode.
     */
    dark: string;
    /**
     * The value for light mode.
     */
    light: string;
}
/**
 * A type to define your custom theme.
 */
export interface Theme {
    /**
     * The name of your app. Also used as the title of the page.
     *
     * @example
     * ```ts
     * {
     *   title: "Acne"
     * }
     * ```
     */
    title?: string;
    /**
     * A URL to the favicon of your app.
     *
     * @example
     * ```ts
     * {
     *   favicon: "https://www.example.com/favicon.svg"
     * }
     * ```
     */
    favicon?: string;
    /**
     * The border radius of the UI elements.
     *
     * @example
     * ```ts
     * {
     *   radius: "none"
     * }
     * ```
     */
    radius?: "none" | "sm" | "md" | "lg" | "full";
    /**
     * The primary color of the theme.
     *
     * Takes a color or both light and dark colors.
     *
     * @example
     * ```ts
     * {
     *   primary: "#FF5E00"
     * }
     * ```
     */
    primary: string | ColorScheme;
    /**
     * The background color of the theme.
     *
     * Takes a color or both light and dark colors.
     *
     * @example
     * ```ts
     * {
     *   background: "#FFF"
     * }
     * ```
     */
    background?: string | ColorScheme;
    /**
     * A URL to the logo of your app.
     *
     * Takes a single image or both light and dark mode versions.
     *
     * @example
     * ```ts
     * {
     *   logo: "https://www.example.com/logo.svg"
     * }
     * ```
     */
    logo?: string | ColorScheme;
    /**
     * The font family and scale of the theme.
     */
    font?: {
        /**
         * The font family of the theme.
         *
         * @example
         * ```ts
         * {
         *   font: {
         *     family: "Geist Mono, monospace"
         *   }
         * }
         * ```
         */
        family?: string;
        /**
         * The font scale of the theme. Can be used to increase or decrease the font sizes across
         * the UI.
         *
         * @default "1"
         * @example
         * ```ts
         * {
         *   font: {
         *     scale: "1.25"
         *   }
         * }
         * ```
         */
        scale?: string;
    };
    /**
     * Custom CSS that's added to the page in a `<style>` tag.
     *
     * This can be used to import custom fonts.
     *
     * @example
     * ```ts
     * {
     *   css: `@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@100;200;300;400;500;600;700;800;900&display=swap');`
     * }
     * ```
     */
    css?: string;
}
/**
 * Built-in default OpenAuth theme.
 */
export declare const THEME_OPENAUTH: Theme;
/**
 * Built-in theme based on [Terminal](https://terminal.shop).
 */
export declare const THEME_TERMINAL: Theme;
/**
 * Built-in theme based on [SST](https://sst.dev).
 */
export declare const THEME_SST: Theme;
/**
 * Built-in theme based on [Supabase](https://supabase.com).
 */
export declare const THEME_SUPABASE: Theme;
/**
 * Built-in theme based on [Vercel](https://vercel.com).
 */
export declare const THEME_VERCEL: Theme;
/**
 * @internal
 */
export declare function setTheme(value: Theme): void;
/**
 * @internal
 */
export declare function getTheme(): any;
//# sourceMappingURL=theme.d.ts.map