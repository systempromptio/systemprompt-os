/**
 * Extended OAuth2 types for generic OAuth2 provider.
 * @module server/external/auth/providers/types/extended-oauth2
 */

import type { IGenericOAuth2Config } from '@/server/external/auth/providers/types/oauth2';

/**
 * Extended OAuth2 Config with additional parameters.
 * @interface IExtendedGenericOAuth2Config
 */
export interface IExtendedGenericOAuth2Config extends IGenericOAuth2Config {
  authorizationParams?: Record<string, string>;
}
