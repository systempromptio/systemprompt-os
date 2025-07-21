/**
 * @fileoverview User management service with proper role assignment
 * @module modules/core/auth/services/user-service
 */

import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../database/index.js';
import { logger } from '@/utils/logger.js';

export interface CreateUserOptions {
  provider: string;
  providerId: string;
  email: string;
  name?: string;
  avatar?: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  roles: string[];
  created_at: string;
  updated_at: string;
}

interface DatabaseUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  is_active: number;
}

interface DatabaseConnection {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  execute(sql: string, params?: unknown[]): Promise<void>;
}

/**
 * Service for managing users with proper first-user detection and role assignment
 */
export class UserService {
  constructor(private db: DatabaseService) {}

  /**
   * Check if any admin users exist in the system
   * This is checked BEFORE any user creation to avoid race conditions
   */
  async hasAdminUsers(): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM auth_users u 
       JOIN auth_user_roles ur ON u.id = ur.user_id 
       JOIN auth_roles r ON ur.role_id = r.id 
       WHERE r.name = 'admin'`
    );
    return (result[0]?.count || 0) > 0;
  }

  /**
   * Create or update a user from OAuth login
   * Handles first-user admin assignment properly
   */
  async createOrUpdateUserFromOAuth(options: CreateUserOptions): Promise<User> {
    const { provider, providerId, email, name, avatar } = options;
    
    // Check if admins exist BEFORE starting the transaction
    const hasAdmins = await this.hasAdminUsers();
    logger.info('Creating/updating user', { email, hasAdmins });

    return this.db.transaction<User>(async (conn: DatabaseConnection) => {
      // Check if OAuth identity exists
      const identityResult = await conn.query<{ user_id: string }>(
        `SELECT user_id FROM auth_oauth_identities 
         WHERE provider = ? AND provider_user_id = ?`,
        [provider, providerId]
      );
      const identity = identityResult.rows[0];

      let userId: string;

      if (identity) {
        // Update existing user
        userId = identity.user_id;
        await conn.execute(
          `UPDATE auth_users 
           SET name = ?, avatar_url = ?, last_login_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ?`,
          [name || null, avatar || null, userId]
        );
        logger.info('Updated existing user', { userId, email });
      } else {
        // Create new user
        userId = randomUUID();
        
        await conn.execute(
          `INSERT INTO auth_users (id, email, name, avatar_url, last_login_at) 
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [userId, email, name || null, avatar || null]
        );

        // Insert OAuth identity
        await conn.execute(
          `INSERT INTO auth_oauth_identities 
           (id, user_id, provider, provider_user_id, provider_data) 
           VALUES (?, ?, ?, ?, ?)`,
          [randomUUID(), userId, provider, providerId, JSON.stringify({ email, name, avatar })]
        );

        // Assign role based on whether admins exist
        // This decision was made BEFORE the transaction started
        const roleId = hasAdmins ? 'role_user' : 'role_admin';
        
        await conn.execute(
          `INSERT INTO auth_user_roles (user_id, role_id) VALUES (?, ?)`,
          [userId, roleId]
        );
        
        logger.info('Created new user with role', { 
          userId, 
          email, 
          role: hasAdmins ? 'user' : 'admin' 
        });
      }

      // Fetch complete user with roles
      const user = await this.getUserByIdWithConnection(userId, conn);
      if (!user) {
        throw new Error('User creation/update failed');
      }

      return user;
    });
  }

  /**
   * Get user by ID with roles using a specific connection
   */
  private async getUserByIdWithConnection(userId: string, conn: DatabaseConnection): Promise<User | null> {
    const userResult = await conn.query<DatabaseUser>(
      'SELECT * FROM auth_users WHERE id = ?',
      [userId]
    );
    
    const userRow = userResult.rows[0];
    if (!userRow) {
      return null;
    }

    // Get roles
    const rolesResult = await conn.query<{ name: string }>(
      `SELECT r.name FROM auth_roles r
       JOIN auth_user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId]
    );

    return {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      avatar_url: userRow.avatar_url,
      roles: rolesResult.rows.map(r => r.name),
      created_at: userRow.created_at,
      updated_at: userRow.updated_at
    };
  }

  /**
   * Get user by ID with roles
   */
  async getUserById(userId: string): Promise<User | null> {
    const userRows = await this.db.query<DatabaseUser>(
      'SELECT * FROM auth_users WHERE id = ?',
      [userId]
    );
    
    const userRow = userRows[0];
    if (!userRow) {
      return null;
    }

    // Get roles
    const roles = await this.db.query<{ name: string }>(
      `SELECT r.name FROM auth_roles r
       JOIN auth_user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId]
    );

    return {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      avatar_url: userRow.avatar_url,
      roles: roles.map((r: { name: string }) => r.name),
      created_at: userRow.created_at,
      updated_at: userRow.updated_at
    };
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const userRows = await this.db.query<DatabaseUser>(
      'SELECT * FROM auth_users WHERE email = ?',
      [email]
    );
    
    const userRow = userRows[0];
    if (!userRow) {
      return null;
    }

    return this.getUserById(userRow.id);
  }
}