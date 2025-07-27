/**
 * OAuth2 provider interface exports.
 * @file Re-exports OAuth2 types from the types folder.
 * @module server/external/auth/providers/interface
 */

export type {
  IOAuth2Provider,
  IOAuth2Config,
  IOAuth2TokenResponse,
  IOAuth2UserInfo,
  IGenericOAuth2Config,
  IGoogleConfig,
  IGitHubConfig,
  // Legacy exports for backward compatibility
  IDPConfig,
  IDPTokens,
  IDPUserInfo,
  IdentityProvider
} from '@/server/external/auth/providers/types/oauth2';

// Re-export without the "I" prefix for backward compatibility
export type {
  IOAuth2Provider as OAuth2Provider,
  IOAuth2Config as OAuth2Config,
  IOAuth2TokenResponse as OAuth2TokenResponse,
  IOAuth2UserInfo as OAuth2UserInfo,
  IGenericOAuth2Config as GenericOAuth2Config,
  IGoogleConfig as GoogleConfig,
  IGitHubConfig as GitHubConfig
} from '@/server/external/auth/providers/types/oauth2';
