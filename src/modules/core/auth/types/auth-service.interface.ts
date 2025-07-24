import type {
 AuthToken, LoginInput, LoginResult, MFASetupResult, TokenCreateInput, TokenValidationResult
} from '@/modules/core/auth/types/index.js';

/**
 *
 * IAuthService interface.
 *
 */

export interface IIAuthService {
  login(input: LoginInput): Promise<LoginResult>;
  setupMFA(userId: string): Promise<MFASetupResult>;
  createToken(_input: TokenCreateInput): Promise<AuthToken>;
  validateToken(_token: string): Promise<TokenValidationResult>;
  logout(userId: string): Promise<void>;
}
