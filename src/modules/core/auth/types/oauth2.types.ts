/**
 * OAuth 2.0 Authorization Server Metadata and Protected Resource Metadata Types.
 * Follows RFC 8414 - OAuth 2.0 Authorization Server Metadata.
 * @file OAuth 2.0 server and protected resource metadata types.
 * @module auth/types/oauth2
 * @see {@link https://datatracker.ietf.org/doc/rfc8414/}
 */

/**
 * OAuth 2.0 Authorization Server Metadata interface (RFC 8414).
 * Used for OpenID Connect Discovery and OAuth 2.0 server metadata.
 */
export interface IOAuth2ServerMetadataInternal {
  /** Authorization server issuer identifier URL */
  issuer: string;
  
  /** URL of the authorization endpoint */
  authorization_endpoint: string;
  
  /** URL of the token endpoint */
  token_endpoint: string;
  
  /** URL of the UserInfo endpoint (OpenID Connect) */
  userinfo_endpoint?: string;
  
  /** URL of the JWK Set document */
  jwks_uri: string;
  
  /** URL of the client registration endpoint */
  registration_endpoint?: string;
  
  /** JSON array containing a list of OAuth 2.0 scope values */
  scopes_supported?: string[];
  
  /** JSON array of OAuth 2.0 response_type values supported */
  response_types_supported: string[];
  
  /** JSON array of OAuth 2.0 grant type values supported */
  grant_types_supported?: string[];
  
  /** JSON array of subject identifier types supported */
  subject_types_supported?: string[];
  
  /** JSON array of JWS signing algorithms supported for ID tokens */
  id_token_signing_alg_values_supported?: string[];
  
  /** JSON array of client authentication methods supported at token endpoint */
  token_endpoint_auth_methods_supported?: string[];
  
  /** JSON array of JWS signing algorithms supported at token endpoint */
  token_endpoint_auth_signing_alg_values_supported?: string[];
  
  /** URL of the end session endpoint */
  end_session_endpoint?: string;
  
  /** URL of the revocation endpoint */
  revocation_endpoint?: string;
  
  /** URL of the introspection endpoint */
  introspection_endpoint?: string;
  
  /** Boolean indicating server support for PKCE */
  code_challenge_methods_supported?: string[];
  
  /** JSON array of display parameter values supported */
  display_values_supported?: string[];
  
  /** JSON array of claim types supported */
  claim_types_supported?: string[];
  
  /** JSON array of claim names supported */
  claims_supported?: string[];
  
  /** Boolean indicating if claims parameter is supported */
  claims_parameter_supported?: boolean;
  
  /** Boolean indicating if request parameter is supported */
  request_parameter_supported?: boolean;
  
  /** Boolean indicating if request_uri parameter is supported */
  request_uri_parameter_supported?: boolean;
  
  /** Boolean indicating if require_request_uri_registration is required */
  require_request_uri_registration?: boolean;
}

/**
 * OAuth 2.0 Protected Resource Metadata interface.
 * Used for protected resource server metadata discovery.
 */
export interface IOAuth2ProtectedResourceMetadataInternal {
  /** Protected resource server identifier */
  resource: string;
  
  /** URL of the authorization server's metadata endpoint */
  authorization_servers?: string[];
  
  /** JSON array of OAuth 2.0 scope values supported by this resource */
  scopes_supported?: string[];
  
  /** JSON array of bearer token usage methods supported */
  bearer_methods_supported?: string[];
  
  /** JSON array of resource indicators supported */
  resource_documentation?: string;
  
  /** JSON array of resource-specific authorization details types supported */
  authorization_details_types_supported?: string[];
}