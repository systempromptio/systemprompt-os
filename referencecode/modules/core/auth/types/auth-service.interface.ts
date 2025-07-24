/**
 * @fileoverview Auth service interface
 * @module modules/core/auth/types
 */

import type { LoginInput, LoginResult, MFASetupResult, TokenCreateInput, AuthToken, TokenValidationResult } from './index.js';

/**
 * Auth service interface
 */
export interface IAuthService {
  login(input: LoginInput): Promise<LoginResult>;
  setupMFA(userId: string): Promise<MFASetupResult>;
  createToken(input: TokenCreateInput): Promise<AuthToken>;
  validateToken(token: string): Promise<TokenValidationResult>;
  logout(userId: string): Promise<void>;
}