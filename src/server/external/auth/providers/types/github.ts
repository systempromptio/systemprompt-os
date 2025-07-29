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

/**
 * GitHub OAuth2 token response from GitHub API.
 */
export interface GitHubTokenResponse {
    access_token?: string;
    token_type?: string;
    scope?: string;
}

/**
 * GitHub user data structure for API responses.
 * Represents the raw data format returned from GitHub's user endpoint.
 */
export interface GitHubUserData {
    id?: number;
    login?: string;
    email?: string | null;
    name?: string | null;
    avatar_url?: string;
    [key: string]: unknown;
}
