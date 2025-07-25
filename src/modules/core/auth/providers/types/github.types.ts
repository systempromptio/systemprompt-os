import type { IDPConfig } from '@/modules/core/auth/types/provider-interface';

/**
 * GitHub OAuth2 configuration interface.
 * Extends the base IDPConfig with GitHub-specific configuration options.
 */
export interface IGitHubConfig extends IDPConfig {
  /** OAuth2 client ID for GitHub application */
  readonly clientId: string;
  /** OAuth2 client secret for GitHub application */
  readonly clientSecret: string;
  /** OAuth2 redirect URI for GitHub application */
  readonly redirectUri: string;
  /** OAuth2 scope for GitHub application permissions */
  readonly scope?: string;
}

/**
 * GitHub API user response interface.
 * Represents the structure of user data returned by GitHub's user API.
 */
export interface IGitHubUserData {
  /** Unique GitHub user ID */
  readonly id: number;
  /** GitHub username/login */
  readonly login: string;
  /** User's display name */
  readonly name?: string;
  /** User's public email address */
  readonly email?: string;
  /** URL to user's avatar image */
  readonly avatar_url: string;
  /** User's location */
  readonly location?: string;
  /** User's bio/description */
  readonly bio?: string;
  /** User's company */
  readonly company?: string;
  /** User's blog/website URL */
  readonly blog?: string;
  /** Whether user's email is publicly visible */
  readonly public_email?: string;
  /** Number of public repositories */
  readonly public_repos: number;
  /** Number of followers */
  readonly followers: number;
  /** Number of users following */
  readonly following: number;
  /** Account creation date */
  readonly created_at: string;
  /** Last profile update date */
  readonly updated_at: string;
}

/**
 * GitHub API email response interface.
 * Represents the structure of email data returned by GitHub's emails API.
 */
export interface IGitHubEmailData {
  /** Email address */
  readonly email: string;
  /** Whether this is the primary email */
  readonly primary: boolean;
  /** Whether the email has been verified */
  readonly verified: boolean;
  /** Visibility level of the email */
  readonly visibility?: string;
}