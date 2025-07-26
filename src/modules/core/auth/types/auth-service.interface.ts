// Minimal type definitions to avoid circular dependency with index.ts
interface AuthToken {
  id: string;
  userId: string;
  token: string;
  type: string;
  scope: string[];
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  isRevoked: boolean;
  metadata?: Record<string, unknown>;
}

interface LoginInput {
  email: string;
  password?: string;
  provider?: string;
  providerId?: string;
  providerData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

interface LoginResult {
  user: unknown;
  session: unknown;
  accessToken: string;
  refreshToken: string;
  requiresMfa: boolean;
}

interface MFASetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

interface TokenCreateInput {
  userId: string;
  type: string;
  scope: string[];
  expiresIn?: number;
  metadata?: Record<string, unknown>;
}

interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  scope?: string[];
  token?: AuthToken;
  reason?: string;
}

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
