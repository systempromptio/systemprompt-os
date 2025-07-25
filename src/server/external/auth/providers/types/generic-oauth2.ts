/**
 * Type definitions for Generic OAuth2 provider.
 * @file Type definitions for Generic OAuth2/OIDC Provider.
 * @module server/external/auth/providers/types/generic-oauth2
 */

import type { IDPConfig } from '@/server/external/auth/providers/interface';

/**
 * Configuration interface for Generic OAuth2 provider.
 * @interface GenericOAuth2Config
 * @augments IDPConfig
 */
export interface GenericOAuth2Config extends IDPConfig {
  id: string;
  name: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string;
  issuer?: string;
  jwksUri?: string;
  scopesSupported?: string[];
  responseTypesSupported?: string[];
  grantTypesSupported?: string[];
  tokenEndpointAuthMethods?: string[];
  userinfoMapping?: {
    id?: string;
    email?: string;
    emailVerified?: string;
    name?: string;
    picture?: string;
  };
}
