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
  name?: string;
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
  user: IUsersRow;
  session: IAuthSessionsRow;
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

/*
 * Type-only imports to avoid circular dependencies and module resolution issues
 * These will be used for the IAuthModuleExports interface when services are fixed
 */
import type { OAuth2ConfigurationService } from '@/modules/core/auth/services/oauth2-config.service';
import type { TunnelService } from '@/modules/core/auth/services/tunnel.service';
import type { ITunnelStatus } from '@/modules/core/auth/types/tunnel.types';
export type { ITunnelStatus };
import type { AuthService } from '@/modules/core/auth/services/auth.service';
import type { TokenService } from '@/modules/core/auth/services/token.service';
import type { UserEventService } from '@/modules/core/auth/services/user-event.service';
import type { AuthCodeService } from '@/modules/core/auth/services/auth-code.service';
import type { MFAService } from '@/modules/core/auth/services/mfa.service';
import type { AuthAuditService } from '@/modules/core/auth/services/audit.service';
import type { IUsersRow } from '@/modules/core/users/types/database.generated';
import type { IAuthSessionsRow } from '@/modules/core/auth/types/database.generated';
export type IdentityProvider = unknown;

/**
 * Authentication module exports interface.
 * Defines all services and functions exported by the auth module.
 */
export interface IAuthModuleExports {
  service: () => AuthService;
  tokenService: () => TokenService;
  userService: () => UserEventService;
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

/**
 * Status check input parameters interface.
 */
export interface IStatusCheckInput {
  includeContainers?: boolean;
  includeUsers?: boolean;
  includeResources?: boolean;
  includeTunnels?: boolean;
  includeAuditLog?: boolean;
}

/**
 * Resource information interface.
 */
export interface IResourceInfo {
  memory: {
    used: number;
    total: number;
    unit: string;
  };
  uptime: {
    seconds: number;
    formatted: string;
  };
}

/**
 * Container information interface.
 */
export interface IContainerInfo {
  status: string;
  count: number;
  details: Array<{
    name: string;
    status: string;
    health: string;
  }>;
}

/**
 * User statistics interface.
 */
export interface IUserStats {
  total: number;
  active: number;
  admins: number;
}

/**
 * Audit log summary interface.
 */
export interface IAuditLogSummary {
  entries: number;
  latest: Array<unknown>;
}

/**
 * Status check result interface.
 */
export interface IStatusCheckResult {
  status: string;
  version: string;
  uptime: number;
  timestamp: string;
  resources?: IResourceInfo;
  containers?: IContainerInfo;
  users?: IUserStats;
  tunnels?: ITunnelStatus;
  auditLog?: IAuditLogSummary;
}

/**
 * Status check response interface.
 */
export interface IStatusCheckResponse {
  message: string;
  result: IStatusCheckResult;
}

/**
 * OAuth2 Server Metadata Internal interface.
 * Internal representation of OAuth2 server metadata.
 */
export interface IOAuth2ServerMetadataInternal {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  registration_endpoint?: string;
  userinfo_endpoint?: string;
  introspection_endpoint?: string;
  revocation_endpoint?: string;
  scopes_supported: string[];
  response_types_supported: string[];
  response_modes_supported?: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  service_documentation?: string;
  code_challenge_methods_supported?: string[];
  subject_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
  claims_supported?: string[];
}

/**
 * OAuth2 Protected Resource Metadata Internal interface.
 * Internal representation of OAuth2 protected resource metadata.
 */
export interface IOAuth2ProtectedResourceMetadataInternal {
  resource: string;
  authorization_servers: string[];
  jwks_uri?: string;
  bearer_methods_supported?: string[];
  resource_documentation?: string;
  scopes_supported?: string[];
}
