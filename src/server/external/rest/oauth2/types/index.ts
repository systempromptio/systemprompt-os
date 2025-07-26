/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Client registration request as per RFC 7591.
 */
export interface IClientRegistrationRequest {
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  redirect_uris?: string[];
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
  contacts?: string[];
  tos_uri?: string;
  policy_uri?: string;
  jwks_uri?: string;
  software_id?: string;
  software_version?: string;
}

/**
 * Client registration response as per RFC 7591.
 */
export interface IClientRegistrationResponse extends IClientRegistrationRequest {
  client_id: string;
  client_secret?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  registration_access_token?: string;
  registration_client_uri?: string;
}

/**
 * OAuth 2.0 Authorization Server Metadata Response
 * Following RFC 8414 specification.
 * @see {@link https://datatracker.ietf.org/doc/rfc8414/}
 */
export interface IAuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported: string[];
  response_modes_supported?: string[];
  grant_types_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  token_endpoint_auth_signing_alg_values_supported?: string[];
  service_documentation?: string;
  ui_locales_supported?: string[];
  op_policy_uri?: string;
  op_tos_uri?: string;
  revocation_endpoint?: string;
  revocation_endpoint_auth_methods_supported?: string[];
  introspection_endpoint?: string;
  introspection_endpoint_auth_methods_supported?: string[];
  code_challenge_methods_supported?: string[];
    userinfo_endpoint?: string;
  acr_values_supported?: string[];
  subject_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
  claims_supported?: string[];
}

/**
 * JWT Token Payload for OAuth2 tokens.
 */
export interface IJWTTokenPayload {
  sub: string;
  clientid?: string | undefined;
  scope?: string | undefined;
  provider?: string | undefined;
  sessionid?: string | undefined;
  tokentype?: 'access' | undefined;
  iss: string;
  aud: string | string[];
  iat: number;
  exp: number;
  jti?: string | undefined;
  user?: IUserData | null | undefined;
  roles?: string[] | undefined;
  email?: string | undefined;
  auth_time?: number | undefined;
  nonce?: string | undefined;
  name?: string | undefined;
  picture?: string | undefined;
}

/**
 * Provider tokens structure.
 */
export interface IProviderTokens {
  code?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  [key: string]: unknown;
}

/**
 * Refresh token data stored in memory.
 */
export interface IRefreshTokenData {
  userId: string;
  clientId: string;
  scope: string;
  expiresAt: Date;
  provider?: string;
}

/**
 * Token request parameters from OAuth2 token endpoint.
 */
export interface ITokenRequestParams {
  grant_type: 'authorization_code' | 'refresh_token';
  code?: string | undefined;
  redirect_uri?: string | undefined;
  client_id?: string | undefined;
  client_secret?: string | undefined;
  refresh_token?: string | undefined;
  code_verifier?: string | undefined;
}

/**
 * OAuth2 token response structure.
 */
export interface ITokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  id_token?: string;
}

/**
 * User data structure.
 */
export interface IUserData {
  id: string;
  email: string;
  name?: string | undefined;
  avatar?: string | undefined;
  roles: string[];
}

/**
 * User session data stored in memory.
 */
export interface IUserSessionData {
  userId: string;
  provider?: string;
  providerTokens?: Record<string, unknown>;
}
