/**
 * Users type definitions.
 */

/**
 * User status enumeration.
 */
export const enum UserStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

/**
 * User entity.
 */
export interface IUser {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  status: UserStatusEnum;
  emailVerified: boolean;
  lastLoginAt?: Date;
  loginAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User profile entity.
 */
export interface IUserProfile {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  timezone: string;
  language: string;
  preferences?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  updatedAt: Date;
}

/**
 * User session entity.
 */
export interface IUserSession {
  id: string;
  userId: string;
  tokenHash: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  lastActivityAt: Date;
}

/**
 * User API key entity.
 */
export interface IUserApiKey {
  id: string;
  userId: string;
  name: string;
  keyHash: string;
  permissions?: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
}

/**
 * User creation data.
 */
export interface IUserCreateData {
  username: string;
  email: string;
  password?: string;
  role?: string;
}

/**
 * User update data.
 */
export interface IUserUpdateData {
  email?: string;
  status?: UserStatusEnum;
  emailVerified?: boolean;
}

/**
 * Authentication result.
 */
export interface IAuthResult {
  success: boolean;
  user?: IUser;
  session?: IUserSession;
  reason?: string;
}

/**
 * Users service interface.
 */
export interface IUsersService {
  createUser(data: IUserCreateData): Promise<IUser>;
  getUser(id: string): Promise<IUser | null>;
  getUserByUsername(username: string): Promise<IUser | null>;
  getUserByEmail(email: string): Promise<IUser | null>;
  listUsers(): Promise<IUser[]>;
  updateUser(id: string, data: IUserUpdateData): Promise<IUser>;
  deleteUser(id: string): Promise<void>;
  authenticateUser(username: string, password: string): Promise<IAuthResult>;
  createSession(userId: string, ipAddress?: string, userAgent?: string): Promise<IUserSession>;
  validateSession(token: string): Promise<IUser | null>;
  revokeSession(sessionId: string): Promise<void>;
  createApiKey(userId: string, name: string, permissions?: string[]): Promise<{ key: string; apiKey: IUserApiKey }>;
  validateApiKey(key: string): Promise<IUser | null>;
  revokeApiKey(keyId: string): Promise<void>;
}