/**
 * Configure OpenAuth to use [DynamoDB](https://aws.amazon.com/dynamodb/) as a storage adapter.
 *
 * ```ts
 * import { DynamoStorage } from "@openauthjs/openauth/storage/dynamo"
 *
 * const storage = DynamoStorage({
 *   table: "my-table",
 *   pk: "pk",
 *   sk: "sk"
 * })
 *
 * export default issuer({
 *   storage,
 *   // ...
 * })
 * ```
 *
 * @packageDocumentation
 */
import { StorageAdapter } from "./storage.js";
/**
 * Configure the DynamoDB table that's created.
 *
 * @example
 * ```ts
 * {
 *   table: "my-table",
 *   pk: "pk",
 *   sk: "sk"
 * }
 * ```
 */
export interface DynamoStorageOptions {
    /**
     * The name of the DynamoDB table.
     */
    table: string;
    /**
     * The primary key column name.
     * @default "pk"
     */
    pk?: string;
    /**
     * The sort key column name.
     * @default "sk"
     */
    sk?: string;
    /**
     * Endpoint URL for the DynamoDB service. Useful for local testing.
     * @default "https://dynamodb.{region}.amazonaws.com"
     */
    endpoint?: string;
    /**
     * The name of the time to live attribute.
     * @default "expiry"
     */
    ttl?: string;
}
/**
 * Creates a DynamoDB store.
 * @param options - The config for the adapter.
 */
export declare function DynamoStorage(options: DynamoStorageOptions): StorageAdapter;
//# sourceMappingURL=dynamo.d.ts.map