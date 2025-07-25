import type {
  AuthToken,
  LoginInput,
  LoginResult,
  MFASetupResult,
  TokenCreateInput,
  TokenValidationResult,
} from '@/modules/core/auth/types/index';

/**
 * Authentication service interface that defines core authentication operations.
 * Provides methods for login, logout, token management, and multi-factor authentication.
 * @interface IAuthService
 * @function login - Authenticates a user with the provided login credentials.
 * @function setupMfa - Sets up multi-factor authentication for a user.
 * @function createToken - Creates a new authentication token.
 * @function validateToken - Validates an existing authentication token.
 * @function logout - Logs out a user by invalidating their session.
 */
export interface IAuthService {
  login(input: LoginInput): Promise<LoginResult>;
  setupMfa(userId: string): Promise<MFASetupResult>;
  createToken(_input: TokenCreateInput): Promise<AuthToken>;
  validateToken(_token: string): Promise<TokenValidationResult>;
  logout(userId: string): Promise<void>;
}

/**
 * Type alias for backward compatibility with existing code.
 * @deprecated Use IAuthService directly instead.
 */
export type AuthService = IAuthService;
