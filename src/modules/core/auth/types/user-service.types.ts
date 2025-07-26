/**
 * Options for creating a new user from OAuth provider data.
 */
export interface ICreateUserOptions {
  provider: string;
  providerId: string;
  email: string;
  name?: string;
  avatar?: string;
}

/**
 * User entity interface with role information.
 */
export interface IUserWithRoles {
  id: string;
  email: string;
  name: string | null;
  avatarurl: string | null;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw database user entity as stored in auth_users table.
 */
export interface IDatabaseUser {
  id: string;
  email: string;
  name: string | null;
  avatarurl: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  isactive: number;
}

/**
 * Database connection interface for transaction operations.
 */
export interface IDatabaseConnection {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  execute(sql: string, params?: unknown[]): Promise<void>;
}
