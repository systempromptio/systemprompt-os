/**
 * Auth module type definitions
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
  expiresIn?: number; // seconds
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
  sub: string; // user id
  email: string;
  name: string;
  roles: string[];
  scope: string[];
  iat: number;
  exp: number;
  jti?: string; // token id
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
  mfa: {
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
  audit: {
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

// Re-export existing types
export * from './provider-interface.js';