/**
 *
 * IUser interface.
 *
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
  roles: Role[];
  permissions: Permission[];
}

/**
 *
 * IRole interface.
 *
 */

export interface IRole {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
}

/**
 *
 * IPermission interface.
 *
 */

export interface IPermission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

/**
 *
 * IOAuthIdentity interface.
 *
 */

export interface IOAuthIdentity {
  id: string;
  userId: string;
  provider: string;
  provideruserId: string;
  providerData?: string;
  createdAt: string;
}

/**
 *
 * ISession interface.
 *
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
