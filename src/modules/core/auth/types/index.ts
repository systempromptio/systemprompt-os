/**
 * Auth module type definitions.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  provider: string;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  mfaBackupCodes?: string[];
}

export interface AuthToken {
  id: string;
  userId: string;
  token: string;
  type: TokenType;
  scope: string[];
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  isRevoked: boolean;
  metadata?: Record<string, unknown>;
}

export type TokenType =
  | 'access'
  | 'refresh'
  | 'api'
  | 'personal'
  | 'service';

export interface TokenCreateInput {
  userId: string;
  type: TokenType;
  scope: string[];
  expiresIn?: number; // Seconds
  metadata?: Record<string, unknown>;
}

export interface MFASetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MFAVerifyInput {
  userId: string;
  code: string;
  isBackupCode?: boolean;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  refreshToken?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface AuthAuditEntry {
  id: string;
  userId?: string;
  action: AuthAuditAction;
  resource?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export type AuthAuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed'
  | 'auth.register'
  | 'mfa.enable'
  | 'mfa.disable'
  | 'mfa.verify'
  | 'mfa.failed'
  | 'token.create'
  | 'token.revoke'
  | 'token.use'
  | 'password.change'
  | 'password.reset'
  | 'session.create'
  | 'session.refresh'
  | 'session.revoke';

export interface LoginInput {
  email: string;
  password?: string;
  provider?: string;
  providerId?: string;
  providerData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginResult {
  user: AuthUser;
  session: AuthSession;
  accessToken: string;
  refreshToken: string;
  requiresMFA: boolean;
}

export interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  scope?: string[];
  token?: AuthToken;
  reason?: string;
}

export interface JWTPayload {
  sub: string; // User id
  email: string;
  name: string;
  roles: string[];
  scope: string[];
  iat: number;
  exp: number;
  jti?: string; // Token id
}

export interface JWTConfig {
  algorithm: string;
  issuer: string;
  audience: string;
  accessTokenTTL: number;
  refreshTokenTTL: number;
  keyStorePath: string;
  privateKey: string;
  publicKey: string;
}

export interface AuthConfig {
  jwt: JWTConfig;
  mfa?: {
    enabled: boolean;
    appName: string;
    backupCodeCount: number;
    windowSize: number;
  };
  session: {
    maxConcurrent: number;
    absoluteTimeout: number;
    inactivityTimeout: number;
  };
  security: {
    maxLoginAttempts: number;
    lockoutDuration: number;
    passwordMinLength: number;
    requirePasswordChange: boolean;
  };
  audit?: {
    enabled: boolean;
    retentionDays: number;
  };
}

export interface ProviderUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Database query result types for auth module.
 */
export interface UserRow {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface RoleRow {
  id: string;
  name: string;
  description?: string;
  is_system: number;
}

export interface PermissionRow {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface UserRoleRow {
  user_id: string;
  role_id: string;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AuditRow {
  id: string;
  user_id?: string;
  action: string;
  resource?: string;
  ip_address?: string;
  user_agent?: string;
  success: number;
  error_message?: string;
  metadata?: string;
  timestamp: string;
}

export interface UserListRow {
  id: string;
  email: string;
  name?: string | null;
  roles?: string | null;
  created_at: string;
  last_login_at?: string | null;
}

// Import service types for exports
import type { AuthService } from '@/modules/core/auth/services/auth.service.js';
import type { TokenService } from '@/modules/core/auth/services/token.service.js';
import type { UserService } from '@/modules/core/auth/services/user-service.js';
import type { AuthCodeService } from '@/modules/core/auth/services/auth-code-service.js';
import type { MFAService } from '@/modules/core/auth/services/mfa.service.js';
import type { AuditService } from '@/modules/core/auth/services/audit.service.js';
import type { IdentityProvider } from '@/modules/core/auth/types/provider-interface.js';

/**
 * Auth module exports interface.
 */
export interface AuthModuleExports {
  service: () => AuthService;
  tokenService: () => TokenService;
  userService: () => UserService;
  authCodeService: () => AuthCodeService;
  mfaService: () => MFAService;
  auditService: () => AuditService;
  getProvider: (id: string) => IdentityProvider | undefined;
  getAllProviders: () => IdentityProvider[];
  createToken: (input: TokenCreateInput) => Promise<AuthToken>;
  validateToken: (token: string) => Promise<TokenValidationResult>;
  hasProvider: (id: string) => boolean;
  getProviderRegistry: () => any;
  reloadProviders: () => Promise<void>;
}

// Re-export existing types
export type * from '@/modules/core/auth/types/provider-interface.js';
export type { IAuthService } from '@/modules/core/auth/types/auth-service.interface.js';
