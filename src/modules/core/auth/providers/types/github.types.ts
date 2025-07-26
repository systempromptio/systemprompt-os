import type { IdpConfig } from '@/modules/core/auth/types/provider-interface';

/**
 * GitHub OAuth2 configuration interface.
 * Extends the base IdpConfig with GitHub-specific configuration options.
 */
export interface IGitHubConfig extends IdpConfig {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly redirectUri: string;
    readonly scope?: string;
}

/**
 * GitHub API user response interface.
 * Represents the structure of user data returned by GitHub's user API.
 */
export interface IGitHubUserData {
    readonly id: number;
    readonly login: string;
    readonly name?: string;
    readonly email?: string;
    readonly avatar_url: string;
    readonly location?: string;
    readonly bio?: string;
    readonly company?: string;
    readonly blog?: string;
    readonly public_email?: string;
    readonly public_repos: number;
    readonly followers: number;
    readonly following: number;
    readonly created_at: string;
    readonly updated_at: string;
    readonly [key: string]: unknown;
}

/**
 * GitHub API email response interface.
 * Represents the structure of email data returned by GitHub's emails API.
 */
export interface IGitHubEmailData {
    readonly email: string;
    readonly primary: boolean;
    readonly verified: boolean;
    readonly visibility?: string;
}
