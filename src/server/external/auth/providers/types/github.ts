/**
 * GitHub OAuth2 provider types.
 * @module server/external/auth/providers/types/github
 */

import type { OAuth2Config } from '@/server/external/auth/providers/interface';

/**
 * GitHub OAuth2 provider configuration.
 */
export interface IGitHubConfig extends OAuth2Config {
    id: string;
    name: string;
}

/**
 * GitHub user profile data from API.
 */
export interface IGitHubUserData {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string;
}

/**
 * GitHub user response from API (raw response).
 */
export interface IGitHubUserResponse {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string;
}

/**
 * GitHub email data from API.
 */
export interface IGitHubEmailData {
    email: string;
    primary: boolean;
    verified: boolean;
}
