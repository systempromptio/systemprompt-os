/**
 * User module type definitions
 */

export interface User {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  provider?: string;
  providerId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export type UserStatus = 'active' | 'disabled' | 'pending';

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
}

export interface UserActivity {
  id: string;
  userId: string;
  type: ActivityType;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export type ActivityType = 
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.enabled'
  | 'user.disabled'
  | 'session.created'
  | 'session.revoked'
  | 'role.granted'
  | 'role.revoked'
  | 'api.access'
  | 'cli.command';

export interface UserCreateInput {
  email: string;
  name: string;
  provider?: string;
  providerId?: string;
  metadata?: Record<string, any>;
}

export interface UserUpdateInput {
  name?: string;
  email?: string;
  status?: UserStatus;
  metadata?: Record<string, any>;
}

export interface UserFilter {
  role?: string;
  status?: UserStatus;
  provider?: string;
  search?: string;
}

export interface UserWithRoles extends User {
  roles: string[];
}

export interface SessionCreateInput {
  userId: string;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  expiresIn?: number;
}

export interface ActivityCreateInput {
  userId: string;
  type: ActivityType;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}