/**
 * OAuth callback query parameters interface.
 */
export interface OAuthCallbackQuery {
  code?: string | string[];
  error?: string | string[];
  errorDescription?: string | string[];
  state?: string | string[];
}

/**
 * Token response from OAuth provider.
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
}
