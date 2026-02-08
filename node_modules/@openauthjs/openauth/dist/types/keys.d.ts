import { JWK, KeyLike } from "jose";
import { StorageAdapter } from "./storage/storage.js";
export interface KeyPair {
    id: string;
    alg: string;
    public: KeyLike;
    private: KeyLike;
    created: Date;
    expired?: Date;
    jwk: JWK;
}
/**
 * @deprecated use `signingKeys` instead
 */
export declare function legacySigningKeys(storage: StorageAdapter): Promise<KeyPair[]>;
export declare function signingKeys(storage: StorageAdapter): Promise<KeyPair[]>;
export declare function encryptionKeys(storage: StorageAdapter): Promise<KeyPair[]>;
//# sourceMappingURL=keys.d.ts.map