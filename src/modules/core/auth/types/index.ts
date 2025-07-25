/**
 *
 * IAuthUser interface.
 *
 */

export interface IAuthUser {
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

/**
 *
 * IAuthToken interface.
 *
 */

export interface IAuthToken {
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

/**
 *
 * TokenType type.
 *
 */

export type TokenType =
  | 'access'
  | 'refresh'
  | 'api'
  | 'personal'
  | 'service';

/**
 *
 * ITokenCreateInput interface.
 *
 */

export interface ITokenCreateInput {
  userId: string;
  type: TokenType;
  scope: string[];
  expiresIn?: number; // Seconds
  metadata?: Record<string, unknown>;
}

/**
 *
 * IMFASetupResult interface.
 *
 */

export interface IMFASetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

/**
 *
 * IMFAVerifyInput interface.
 *
 */

export interface IMFAVerifyInput {
  userId: string;
  code: string;
  isBackupCode?: boolean;
}

/**
 *
 * IAuthSession interface.
 *
 */

export interface IAuthSession {
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

/**
 *
 * IAuthAuditEntry interface.
 *
 */

export interface IAuthAuditEntry {
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

/**
 *
 * AuthAuditAction type.
 *
 */

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

/**
 *
 * ILoginInput interface.
 *
 */

export interface ILoginInput {
  email: string;
  password?: string;
  provider?: string;
  providerId?: string;
  providerData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 *
 * ILoginResult interface.
 *
 */

export interface ILoginResult {
  user: IAuthUser;
  session: IAuthSession;
  accessToken: string;
  refreshToken: string;
  requiresMFA: boolean;
}

/**
 *
 * ITokenValidationResult interface.
 *
 */

export interface ITokenValidationResult {
  valid: boolean;
  userId?: string;
  scope?: string[];
  token?: IAuthToken;
  reason?: string;
}

/**
 *
 * IJWTPayload interface.
 *
 */

export interface IJWTPayload {
  sub: string; // User id
  email: string;
  name: string;
  roles: string[];
  scope: string[];
  iat: number;
  exp: number;
  jti?: string; // Token id
}

/**
 *
 * IJWTConfig interface.
 *
 */

export interface IJWTConfig {
  algorithm: string;
  issuer: string;
  audience: string;
  accessTokenTTL: number;
  refreshTokenTTL: number;
  keyStorePath: string;
  privateKey: string;
  publicKey: string;
}

/**
 *
 * IAuthConfig interface.
 *
 */

export interface IAuthConfig {
  jwt: IJWTConfig;
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

/**
 *
 * IProviderUser interface.
 *
 */

export interface IProviderUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  metadata?: Record<string, unknown>;
}

/**
 *
 * IUserRow interface.
 *
 */

export interface IUserRow {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

/**
 *
 * IRoleRow interface.
 *
 */

export interface IRoleRow {
  id: string;
  name: string;
  description?: string;
  isSystem: number;
}

/**
 *
 * IPermissionRow interface.
 *
 */

export interface IPermissionRow {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

/**
 *
 * IUserRoleRow interface.
 *
 */

export interface IUserRoleRow {
  userId: string;
  roleId: string;
  createdAt: string;
}

/**
 *
 * ISessionRow interface.
 *
 */

export interface ISessionRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  ip_address?: string;
  user_agent?: string;
  createdAt: string;
}

/**
 *
 * IAuditRow interface.
 *
 */

export interface IAuditRow {
  id: string;
  userId?: string;
  action: string;
  resource?: string;
  ip_address?: string;
  user_agent?: string;
  success: number;
  error_message?: string;
  metadata?: string;
  timestamp: string;
}

/**
 *
 * IUserListRow interface.
 *
 */

export interface IUserListRow {
  id: string;
  email: string;
  name?: string | null;
  roles?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
}

import type { AuthService } from '@/modules/core/auth/services/auth.service.js';
import type { TokenService } from '@/modules/core/auth/services/token.service.js';
import type { UserService } from '@/modules/core/auth/services/user-service.js';
import type { AuthCodeService } from '@/modules/core/auth/services/auth-code-service.js';
import type { MFAService } from '@/modules/core/auth/services/mfa.service.js';
import type { AuditService } from '@/modules/core/auth/services/audit.service.js';
import type { OAuth2ConfigService } from '@/modules/core/auth/services/oauth2-config.service.js';
import type { IdentityProvider } from '@/modules/core/auth/types/provider-interface.js';

/**
 *
 * IAuthModuleExports interface.
 *
 */

export interface IAuthModuleExports {
  service: () => AuthService;
  tokenService: () => TokenService;
  userService: () => UserService;
  authCodeService: () => AuthCodeService;
  mfaService: () => MFAService;
  auditService: () => AuditService;
  oauth2ConfigService: () => OAuth2ConfigService;
  getProvider: (id: string) => IdentityProvider | undefined;
  getAllProviders: () => IdentityProvider[];
  createToken: (_input: ITokenCreateInput) => Promise<IAuthToken>;
  validateToken: (_token: string) => Promise<ITokenValidationResult>;
  hasProvider: (id: string) => boolean;
  getProviderRegistry: () => any;
  reloadProviders: () => Promise<void>;
}

export type * from '@/modules/core/auth/types/provider-interface.js';
export type { IAuthService } from '@/modules/core/auth/types/auth-service.interface.js';

// Type aliases for compatibility
export type AuthUser = IAuthUser;
export type AuthToken = IAuthToken;
export type AuthSession = IAuthSession;
export type AuthAuditEntry = IAuthAuditEntry;
export type LoginInput = ILoginInput;
export type LoginResult = ILoginResult;
export type TokenValidationResult = ITokenValidationResult;
export type JWTPayload = IJWTPayload;
export type JWTConfig = IJWTConfig;
export type AuthConfig = IAuthConfig;
export type ProviderUser = IProviderUser;
export type UserRow = IUserRow;
export type RoleRow = IRoleRow;
export type PermissionRow = IPermissionRow;
export type UserRoleRow = IUserRoleRow;
export type SessionRow = ISessionRow;
export type AuditRow = IAuditRow;
export type UserListRow = IUserListRow;
export type AuthModuleExports = IAuthModuleExports;
export type TokenCreateInput = ITokenCreateInput;
export type MFASetupResult = IMFASetupResult;
export type MFAVerifyInput = IMFAVerifyInput;
