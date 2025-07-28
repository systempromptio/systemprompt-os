/**
 * Auth module configuration builder.
 */

import { FIVE } from '@/constants/numbers';
import type { AuthConfig } from '@/modules/core/auth/types/index';

/**
 * Build auth configuration with defaults.
 * @returns The complete authentication configuration.
 */
export function buildAuthConfig(): AuthConfig {
  return {
    jwt: {
      algorithm: 'RS256',
      issuer: 'systemprompt-os',
      audience: 'systemprompt-os',
      accessTokenTTL: 900,
      refreshTokenTTL: 2592000,
      keyStorePath: process.env.JWT_KEY_PATH ?? './state/auth/keys',
      privateKey: '',
      publicKey: ''
    },
    session: {
      maxConcurrent: FIVE,
      absoluteTimeout: 86400,
      inactivityTimeout: 3600
    },
    security: {
      maxLoginAttempts: FIVE,
      lockoutDuration: 900,
      passwordMinLength: 8,
      requirePasswordChange: false,
    },
  };
}
