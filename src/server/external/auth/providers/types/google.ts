/**
 * Type definitions for Google OAuth2 provider.
 * @file Type definitions for Google OAuth2/OpenID Connect Provider.
 * @module server/external/auth/providers/types/google
 */

import type { IDPConfig } from '@/server/external/auth/providers/interface';

/**
 * Configuration interface for Google OAuth2 provider.
 * @interface IGoogleConfig
 * @augments IDPConfig
 */
export interface IGoogleConfig extends IDPConfig {
    discoveryurl?: string;
}

/**
 * Google user information response structure.
 * @interface IGoogleUserInfo
 */
export interface IGoogleUserInfo {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    locale?: string;
    given_name?: string;
    family_name?: string;
    [key: string]: unknown;
}
