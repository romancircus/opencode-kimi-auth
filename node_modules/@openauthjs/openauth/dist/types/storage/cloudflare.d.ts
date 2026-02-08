/**
 * Configure OpenAuth to use [Cloudflare KV](https://developers.cloudflare.com/kv/) as a
 * storage adapter.
 *
 * ```ts
 * import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare"
 *
 * const storage = CloudflareStorage({
 *   namespace: "my-namespace"
 * })
 *
 *
 * export default issuer({
 *   storage,
 *   // ...
 * })
 * ```
 *
 * @packageDocumentation
 */
import type { KVNamespace } from "@cloudflare/workers-types";
import { StorageAdapter } from "./storage.js";
/**
 * Configure the Cloudflare KV store that's created.
 */
export interface CloudflareStorageOptions {
    namespace: KVNamespace;
}
/**
 * Creates a Cloudflare KV store.
 * @param options - The config for the adapter.
 */
export declare function CloudflareStorage(options: CloudflareStorageOptions): StorageAdapter;
//# sourceMappingURL=cloudflare.d.ts.map