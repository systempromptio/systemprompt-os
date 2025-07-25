/**
 * Provider configuration interface for OAuth2/OIDC providers.
 */
export interface ProviderConfig {
  id: string;
  name: string;
  type: "oauth2" | "oidc" | "saml";
  enabled: boolean;
  endpoints: {
    authorization: string;
    token: string;
    userinfo?: string;
    revocation?: string;
    discovery?: string;
    jwks?: string;
    emails?: string;
  };
  scopes?: string[];
  parameters?: Record<string, unknown>;
  tokenEndpointAuthMethod?: string;
  userinfoMapping?: Record<string, string>;
  features?: Record<string, unknown>;
  credentials: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    privateKeyPath?: string;
    kid?: string;
  };
}

/**
 * OIDC Discovery Response interface for well-known configuration endpoints.
 */
export interface OIDCDiscoveryResponse {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  scopesSupported?: string[];
  responseTypesSupported?: string[];
  grantTypesSupported?: string[];
  tokenEndpointAuthMethodsSupported?: string[];
}
