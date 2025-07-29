import type { UsersStatus } from '@/modules/core/users/types/database.generated';

/**
 * User entity.
 */
export interface IUser {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  timezone: string;
  language: string;
  status: UsersStatus;
  emailVerified: boolean;
  preferences?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User creation data.
 */
export interface IUserCreateData {
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  timezone?: string;
  language?: string;
}

/**
 * User update data.
 */
export interface IUserUpdateData {
  username?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  timezone?: string;
  language?: string;
  status?: UsersStatus;
  emailVerified?: boolean;
  preferences?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Users service interface - only handles user data management.
 */
export interface IUsersService {
  createUser(data: IUserCreateData): Promise<IUser>;
  getUser(id: string): Promise<IUser | null>;
  getUserByUsername(username: string): Promise<IUser | null>;
  getUserByEmail(email: string): Promise<IUser | null>;
  listUsers(): Promise<IUser[]>;
  updateUser(id: string, data: IUserUpdateData): Promise<IUser>;
  deleteUser(id: string): Promise<void>;
  searchUsers(query: string): Promise<IUser[]>;
}

/**
 * Strongly typed exports interface for Users module.
 */
export interface IUsersModuleExports {
  readonly service: () => IUsersService;
}

// Re-export CLI types
export type { IUpdateUserArgs, IDisplayOptions } from '@/modules/core/users/types/cli.types';
