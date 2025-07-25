/**
 * OAuth2 Server Metadata following RFC 8414.
 * All properties use snake_case as per OAuth2 specification requirements.
 * This cannot be changed to camelCase as it would violate RFC standards.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface IOAuth2ServerMetadata {
    issuer: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    jwksUri: string;
    registrationEndpoint?: string;
    scopesSupported?: string[];
    responseTypesSupported: string[];
    responseModesSupported?: string[];
    grantTypesSupported?: string[];
    tokenEndpointAuthMethodsSupported?: string[];
    tokenEndpointAuthSigningAlgValuesSupported?: string[];
    serviceDocumentation?: string;
    uiLocalesSupported?: string[];
    opPolicyUri?: string;
    opTosUri?: string;
    revocationEndpoint?: string;
    revocationEndpointAuthMethodsSupported?: string[];
    introspectionEndpoint?: string;
    introspectionEndpointAuthMethodsSupported?: string[];
    codeChallengeMethodsSupported?: string[];
    userinfoEndpoint?: string;
    acrValuesSupported?: string[];
    subjectTypesSupported?: string[];
    idTokenSigningAlgValuesSupported?: string[];
    claimsSupported?: string[];
}

/**
 * OAuth2 Protected Resource Metadata following RFC 9728.
 * All properties use snake_case as per OAuth2 specification requirements.
 * This cannot be changed to camelCase as it would violate RFC standards.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface IOAuth2ProtectedResourceMetadata {
    resource: string;
    authorizationServers: string[];
    bearerMethodsSupported?: string[];
    resourceDocumentation?: string;
    resourceSigningAlgValuesSupported?: string[];
    resourceEncryptionAlgValuesSupported?: string[];
    resourceEncryptionEncValuesSupported?: string[];
    scopesSupported?: string[];
}

/**
 * Internal representation of OAuth2 server metadata with snake_case properties.
 * This is used to maintain RFC compliance while satisfying TypeScript requirements.
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface IOAuth2ServerMetadataInternal {

  issuer: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  authorization_endpoint: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  token_endpoint: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  jwks_uri: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  registration_endpoint?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  scopes_supported?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  response_types_supported: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  response_modes_supported?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  grant_types_supported?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  token_endpoint_auth_methods_supported?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  token_endpoint_auth_signing_alg_values_supported?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  service_documentation?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ui_locales_supported?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  op_policy_uri?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  op_tos_uri?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  revocation_endpoint?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  revocation_endpoint_auth_methods_supported?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  introspection_endpoint?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  introspection_endpoint_auth_methods_supported?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  code_challenge_methods_supported?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  userinfo_endpoint?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  acr_values_supported?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  subject_types_supported?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  id_token_signing_alg_values_supported?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  claims_supported?: string[];
}

/**
 * Internal representation of OAuth2 protected resource metadata with snake_case properties.
 * This is used to maintain RFC compliance while satisfying TypeScript requirements.
 * @internal
 */
// eslint-disable @typescript-eslint/naming-convention
export interface IOAuth2ProtectedResourceMetadataInternal {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported?: string[];
  resource_documentation?: string;
  resource_signing_alg_values_supported?: string[];
  resource_encryption_alg_values_supported?: string[];
  resource_encryption_enc_values_supported?: string[];
  scopes_supported?: string[];
}
// eslint-enable @typescript-eslint/naming-convention
