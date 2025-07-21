/**
 * @fileoverview OAuth2 type definitions based on RFC 6749
 * @module types/oauth2
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6749}
 */

/**
 * OAuth2 Token Response (RFC 6749 Section 5.1)
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6749#section-5.1}
 */
export interface OAuth2TokenResponse {
  /** The access token issued by the authorization server */
  access_token: string;
  
  /** The type of the token issued (typically "Bearer") */
  token_type: string;
  
  /** The lifetime in seconds of the access token */
  expires_in?: number;
  
  /** The refresh token, which can be used to obtain new access tokens */
  refresh_token?: string;
  
  /** The scope of the access token */
  scope?: string;
  
  /** Additional fields may be included */
  [key: string]: any;
}

/**
 * OAuth2 Error Response (RFC 6749 Section 5.2)
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6749#section-5.2}
 */
export interface OAuth2ErrorResponse {
  /** A single ASCII error code */
  error: 'invalid_request' | 'invalid_client' | 'invalid_grant' | 
         'unauthorized_client' | 'unsupported_grant_type' | 
         'invalid_scope' | string;
  
  /** Human-readable ASCII text providing additional information */
  error_description?: string;
  
  /** A URI identifying a human-readable web page with error information */
  error_uri?: string;
}

/**
 * OAuth2 Authorization Request (RFC 6749 Section 4.1.1)
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.1}
 */
export interface OAuth2AuthorizationRequest {
  /** REQUIRED. Value MUST be set to "code" */
  response_type: 'code';
  
  /** REQUIRED. The client identifier */
  client_id: string;
  
  /** OPTIONAL. The client's redirection endpoint */
  redirect_uri?: string;
  
  /** OPTIONAL. The scope of the access request */
  scope?: string;
  
  /** RECOMMENDED. An opaque value used to maintain state */
  state?: string;
}

/**
 * OAuth2 Access Token Request (RFC 6749 Section 4.1.3)
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.3}
 */
export interface OAuth2AccessTokenRequest {
  /** REQUIRED. Value MUST be set to "authorization_code" */
  grant_type: 'authorization_code';
  
  /** REQUIRED. The authorization code */
  code: string;
  
  /** REQUIRED if included in authorization request */
  redirect_uri?: string;
  
  /** REQUIRED if the client is not authenticating with the authorization server */
  client_id: string;
  
  /** Client secret for confidential clients */
  client_secret?: string;
}

/**
 * OAuth2 Refresh Token Request (RFC 6749 Section 6)
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6749#section-6}
 */
export interface OAuth2RefreshTokenRequest {
  /** REQUIRED. Value MUST be set to "refresh_token" */
  grant_type: 'refresh_token';
  
  /** REQUIRED. The refresh token */
  refresh_token: string;
  
  /** OPTIONAL. The scope of the access request */
  scope?: string;
  
  /** REQUIRED if the client is not authenticating with the authorization server */
  client_id?: string;
  
  /** Client secret for confidential clients */
  client_secret?: string;
}

/**
 * PKCE Extension for OAuth2 (RFC 7636)
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7636}
 */
export interface OAuth2PKCEAuthorizationRequest extends OAuth2AuthorizationRequest {
  /** REQUIRED. Code challenge derived from code verifier */
  code_challenge: string;
  
  /** OPTIONAL. Defaults to "plain" if not present */
  code_challenge_method?: 'S256' | 'plain';
}

export interface OAuth2PKCETokenRequest extends OAuth2AccessTokenRequest {
  /** REQUIRED. Code verifier */
  code_verifier: string;
}

/**
 * OpenID Connect additions to OAuth2
 */
export interface OpenIDTokenResponse extends OAuth2TokenResponse {
  /** ID Token value associated with the authenticated session */
  id_token?: string;
}

/**
 * OAuth2 Client Credentials
 */
export interface OAuth2ClientCredentials {
  client_id: string;
  client_secret?: string;
  redirect_uri: string;
  scope?: string;
}

/**
 * OAuth2 Client Configuration (with endpoints)
 */
export interface OAuth2ClientConfig extends OAuth2ClientCredentials {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
}

/**
 * OAuth2 Provider Configuration
 */
export interface OAuth2ProviderConfig {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  response_modes_supported?: string[];
  grant_types_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  code_challenge_methods_supported?: string[];
}