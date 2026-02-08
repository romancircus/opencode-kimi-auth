/**
 * Configure OpenAuth to use a simple in-memory store.
 *
 * :::caution
 * This is not meant to be used in production.
 * :::
 *
 * This is useful for testing and development. It's not meant to be used in production.
 *
 * ```ts
 * import { MemoryStorage } from "@openauthjs/openauth/storage/memory"
 *
 * const storage = MemoryStorage()
 *
 * export default issuer({
 *   storage,
 *   // ...
 * })
 * ```
 *
 * Optionally, you can persist the store to a file.
 *
 * ```ts
 * MemoryStorage({
 *   persist: "./persist.json"
 * })
 * ```
 *
 * @packageDocumentation
 */
import { StorageAdapter } from "./storage.js";
/**
 * Configure the memory store.
 */
export interface MemoryStorageOptions {
    /**
     * Optionally, backup the store to a file. So it'll be persisted when the issuer restarts.
     *
     * @example
     * ```ts
     * {
     *   persist: "./persist.json"
     * }
     * ```
     */
    persist?: string;
}
export declare function MemoryStorage(input?: MemoryStorageOptions): StorageAdapter;
//# sourceMappingURL=memory.d.ts.map