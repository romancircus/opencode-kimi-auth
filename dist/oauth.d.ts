export interface DeviceAuthorizationResponse {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    expires_in: number;
    interval: number;
}
export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    scope?: string;
}
export declare function requestDeviceAuthorization(): Promise<DeviceAuthorizationResponse>;
export declare function pollForToken(deviceCode: string, options?: {
    pollInterval?: number;
    timeout?: number;
}): Promise<TokenResponse>;
export declare function refreshToken(refreshToken: string): Promise<TokenResponse>;
export declare function storeToken(token: TokenResponse): Promise<void>;
export declare function getToken(): Promise<TokenResponse | null>;
export declare function clearCredentials(): Promise<void>;
export declare function isAuthenticated(): Promise<boolean>;
//# sourceMappingURL=oauth.d.ts.map