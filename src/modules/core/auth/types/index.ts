/**
 * Token type enumeration.
 * Defines the different types of tokens that can be issued.
 */
export type TokenType =
  | 'access'
  | 'refresh'
  | 'api'
  | 'personal'
  | 'service';

/**
 * Authentication user entity interface.
 * Represents a user in the authentication system with all core properties.
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
 * Authentication token interface.
 * Represents a token entity with metadata and validation information.
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
 * Token creation input interface.
 * Input parameters required for creating a new authentication token.
 */
export interface ITokenCreateInput {
  userId: string;
  type: TokenType;
  scope: string[];
  expiresIn?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Multi-factor authentication setup result interface.
 * Contains the necessary information for setting up MFA for a user.
 */
export interface IMfaSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

/**
 * Multi-factor authentication verification input interface.
 * Input parameters required for verifying an MFA code.
 */
export interface IMfaVerifyInput {
  userId: string;
  code: string;
  isBackupCode?: boolean;
}

/**
 * Authentication session interface.
 * Represents an active user session with tracking information.
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
 * Authentication audit action enumeration.
 * Defines all possible audit actions that can be logged in the system.
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
 * Authentication audit entry interface.
 * Represents a single audit log entry for authentication events.
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
 * Login input interface.
 * Input parameters required for user authentication login.
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
 * Login result interface.
 * Contains the result of a successful login attempt.
 */
export interface ILoginResult {
  user: IAuthUser;
  session: IAuthSession;
  accessToken: string;
  refreshToken: string;
  requiresMfa: boolean;
}

/**
 * Token validation result interface.
 * Contains the result of token validation with user context.
 */
export interface ITokenValidationResult {
  valid: boolean;
  userId?: string;
  scope?: string[];
  token?: IAuthToken;
  reason?: string;
}

/**
 * JSON Web Token payload interface.
 * Standard JWT claims with application-specific extensions.
 */
export interface IJwtPayload {
  sub: string;
  email: string;
  name: string;
  roles: string[];
  scope: string[];
  iat: number;
  exp: number;
  jti?: string;
}

/**
 * JSON Web Token configuration interface.
 * Configuration settings for JWT token generation and validation.
 */
export interface IJwtConfig {
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
 * Authentication configuration interface.
 * Complete configuration for the authentication system.
 */
export interface IAuthConfig {
  jwt: IJwtConfig;
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
 * Identity provider user interface.
 * User information received from external identity providers.
 */
export interface IProviderUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Database user row interface.
 * Raw database representation of a user record.
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
 * Database role row interface.
 * Raw database representation of a role record.
 */
export interface IRoleRow {
  id: string;
  name: string;
  description?: string;
  isSystem: number;
}

/**
 * Database permission row interface.
 * Raw database representation of a permission record.
 */
export interface IPermissionRow {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

/**
 * Database user-role relationship row interface.
 * Raw database representation of user-role associations.
 */
export interface IUserRoleRow {
  userId: string;
  roleId: string;
  createdAt: string;
}

/**
 * Database session row interface.
 * Raw database representation of a session record.
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
 * Database audit row interface.
 * Raw database representation of an audit log record.
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
 * Database user list row interface.
 * User data with aggregated role information for list views.
 */
export interface IUserListRow {
  id: string;
  email: string;
  name?: string | null;
  roles?: string | null;
  created_at: string;
  last_login_at?: string | null;
}

/*
 * Type-only imports to avoid circular dependencies and module resolution issues
 * These will be used for the IAuthModuleExports interface when services are fixed
 */
import type { OAuth2ConfigurationService } from '@/modules/core/auth/services/oauth2-config.service';
import type { TunnelService } from '@/modules/core/auth/services/tunnel.service';
import type { ITunnelStatus } from '@/modules/core/auth/types/tunnel.types';

type AuthService = unknown;
type TokenService = unknown;
type UserService = unknown;
type AuthCodeService = unknown;
type MFAService = unknown;
type AuthAuditService = unknown;
type IdentityProvider = unknown;

/**
 * Authentication module exports interface.
 * Defines all services and functions exported by the auth module.
 */
export interface IAuthModuleExports {
  service: () => AuthService;
  tokenService: () => TokenService;
  userService: () => UserService;
  authCodeService: () => AuthCodeService;
  mfaService: () => MFAService;
  auditService: () => AuthAuditService;
  oauth2ConfigService: () => OAuth2ConfigurationService;
  getProvider: (id: string) => IdentityProvider | undefined;
  getAllProviders: () => IdentityProvider[];
  createToken: (input: ITokenCreateInput) => Promise<IAuthToken>;
  validateToken: (token: string) => Promise<ITokenValidationResult>;
  hasProvider: (id: string) => boolean;
  getProviderRegistry: () => unknown;
  reloadProviders: () => Promise<void>;
  getTunnelService: () => TunnelService | null;
  getTunnelStatus: () => ITunnelStatus;
  listUserTokens: (userId: string) => Promise<IAuthToken[]>;
  revokeToken: (tokenId: string) => Promise<void>;
  revokeUserTokens: (userId: string, type?: string) => Promise<void>;
  cleanupExpiredTokens: () => Promise<number>;
}

// Re-exporting types from other files in the auth module
export type * from '@/modules/core/auth/types/provider-interface';
export type { IAuthService } from '@/modules/core/auth/types/auth-service.interface';
export type * from '@/modules/core/auth/types/oauth2.types';
export type * from '@/modules/core/auth/types/auth-code.types';
export type * from '@/modules/core/auth/types/repository.types';
export type * from '@/modules/core/auth/types/generate-key.types';
export type * from '@/modules/core/auth/types/user-service.types';
export type * from '@/modules/core/auth/types/tunnel.types';
export type * from '@/modules/core/auth/types/tool.types';
export type * from '@/modules/core/auth/types/mfa.types';
export type { OAuth2ConfigurationService } from '@/modules/core/auth/services/oauth2-config.service';

/**
 * Type alias for AuthUser interface for compatibility.
 */
export type AuthUser = IAuthUser;

/**
 * Type alias for AuthToken interface for compatibility.
 */
export type AuthToken = IAuthToken;

/**
 * Type alias for AuthSession interface for compatibility.
 */
export type AuthSession = IAuthSession;

/**
 * Type alias for AuthAuditEntry interface for compatibility.
 */
export type AuthAuditEntry = IAuthAuditEntry;

/**
 * Type alias for LoginInput interface for compatibility.
 */
export type LoginInput = ILoginInput;

/**
 * Type alias for LoginResult interface for compatibility.
 */
export type LoginResult = ILoginResult;

/**
 * Type alias for TokenValidationResult interface for compatibility.
 */
export type TokenValidationResult = ITokenValidationResult;

/**
 * Type alias for JwtPayload interface for compatibility.
 */
export type JwtPayload = IJwtPayload;

/**
 * Type alias for JwtConfig interface for compatibility.
 */
export type JwtConfig = IJwtConfig;

/**
 * Type alias for AuthConfig interface for compatibility.
 */
export type AuthConfig = IAuthConfig;

/**
 * Type alias for ProviderUser interface for compatibility.
 */
export type ProviderUser = IProviderUser;

/**
 * Type alias for UserRow interface for compatibility.
 */
export type UserRow = IUserRow;

/**
 * Type alias for RoleRow interface for compatibility.
 */
export type RoleRow = IRoleRow;

/**
 * Type alias for PermissionRow interface for compatibility.
 */
export type PermissionRow = IPermissionRow;

/**
 * Type alias for UserRoleRow interface for compatibility.
 */
export type UserRoleRow = IUserRoleRow;

/**
 * Type alias for SessionRow interface for compatibility.
 */
export type SessionRow = ISessionRow;

/**
 * Type alias for AuditRow interface for compatibility.
 */
export type AuditRow = IAuditRow;

/**
 * Type alias for UserListRow interface for compatibility.
 */
export type UserListRow = IUserListRow;

/**
 * Type alias for AuthModuleExports interface for compatibility.
 */
export type AuthModuleExports = IAuthModuleExports;

/**
 * Type alias for TokenCreateInput interface for compatibility.
 */
export type TokenCreateInput = ITokenCreateInput;

/**
 * Type alias for MfaSetupResult interface for compatibility.
 */
export type MfaSetupResult = IMfaSetupResult;

/**
 * Type alias for MfaVerifyInput interface for compatibility.
 */
export type MfaVerifyInput = IMfaVerifyInput;

/**
 * MFA configuration interface.
 * Configuration settings for multi-factor authentication.
 */
export interface IMFAConfig {
  appName: string;
  backupCodeCount: number;
  windowSize: number;
}

/**
 * User MFA data interface.
 * Database representation of user MFA settings.
 */
export interface IUserMFAData {
  id: string;
  mfa_secret?: string | null;
  mfa_enabled?: number;
  mfa_backup_codes?: string | null;
}

/**
 * Database row interface for auth_tokens table.
 * Raw database representation of a token record.
 */
export interface ITokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  type: string;
  scope: string;
  expiresAt: string;
  createdAt: string;
  lastUsedAt?: string;
  isRevoked: boolean;
  metadata?: string;
}

/**
 * JSON Web Token creation parameters interface.
 * Parameters required for creating a JWT token.
 */
export interface IJwtParams {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  scope?: string[];
}

/**
 * Role entity interface.
 * Represents a user role with metadata.
 */
export interface IRole {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
}

/**
 * Permission entity interface.
 * Represents a permission with resource and action scope.
 */
export interface IPermission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

/**
 * User entity interface with complete information.
 * Complete user model including roles and permissions.
 */
export interface IUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  roles: IRole[];
  permissions: IPermission[];
}

/**
 * OAuth identity entity interface.
 * Links user accounts to external OAuth provider identities.
 */
export interface IOauthIdentity {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  providerData?: string;
  createdAt: string;
}

/**
 * Session entity interface.
 * Represents an active user session with tracking data.
 */
export interface ISession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  lastAccessedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * AuditEvent interface for service layer operations.
 * Represents an audit event to be logged.
 */
export interface IAuditEvent {
  userId?: string;
  action: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Database row interface for auth_audit_log table queries.
 * Represents the structure of audit data as stored in the database.
 */
export interface IAuditEventRow {
  userId: string;
  action: string;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}
