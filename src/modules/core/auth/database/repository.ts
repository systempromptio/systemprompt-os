/**
 * Auth module database repository
 * Handles all database operations for authentication and authorization
 */

import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../database/index.js';
import type { 
  User, 
  Role, 
  Permission, 
  OAuthIdentity 
} from './models/index.js';

export class AuthRepository {
  constructor(private db: DatabaseService) {}

  /**
   * Create or update a user from OAuth login
   */
  async upsertUserFromOAuth(
    provider: string,
    providerId: string,
    profile: {
      email: string;
      name?: string;
      avatar?: string;
    }
  ): Promise<User> {
    return this.db.transaction(async (conn) => {
      // Check if OAuth identity exists
      const identity = await conn.query<OAuthIdentity>(
        `SELECT * FROM auth_oauth_identities 
         WHERE provider = ? AND provider_user_id = ?`,
        [provider, providerId]
      ).then(r => r.rows[0]);

      let userId: string;

      if (identity) {
        // Update existing user
        userId = identity.user_id;
        await conn.execute(
          `UPDATE auth_users 
           SET name = ?, avatar_url = ?, last_login_at = datetime('now') 
           WHERE id = ?`,
          [profile.name, profile.avatar, userId]
        );
      } else {
        // Create new user
        userId = randomUUID();
        
        // Insert user
        await conn.execute(
          `INSERT INTO auth_users (id, email, name, avatar_url, last_login_at) 
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [userId, profile.email, profile.name, profile.avatar]
        );

        // Insert OAuth identity
        await conn.execute(
          `INSERT INTO auth_oauth_identities 
           (id, user_id, provider, provider_user_id, provider_data) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            userId,
            provider,
            providerId,
            JSON.stringify(profile)
          ]
        );

        // Assign default role
        const isFirstUser = await this.isFirstUser();
        const roleId = isFirstUser ? 'role_admin' : 'role_user';
        
        await conn.execute(
          `INSERT INTO auth_user_roles (user_id, role_id) 
           VALUES (?, ?)`,
          [userId, roleId]
        );
      }

      // Fetch and return complete user
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User creation failed');
      }
      return user;
    });
  }

  /**
   * Get user by ID with roles and permissions
   */
  async getUserById(userId: string): Promise<User | null> {
    const userRow = await this.db.query<any>(
      'SELECT * FROM auth_users WHERE id = ?',
      [userId]
    ).then(rows => rows[0]);

    if (!userRow) {
      return null;
    }

    // Get roles
    const roles = await this.getUserRoles(userId);

    // Get permissions through roles
    const permissions = await this.getUserPermissions(userId);

    return {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      avatarUrl: userRow.avatar_url,
      isActive: Boolean(userRow.is_active),
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at,
      lastLoginAt: userRow.last_login_at,
      roles,
      permissions
    };
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const userRow = await this.db.query<any>(
      'SELECT id FROM auth_users WHERE email = ?',
      [email]
    ).then(rows => rows[0]);

    if (!userRow) {
      return null;
    }

    return this.getUserById(userRow.id);
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    const rows = await this.db.query<any>(
      `SELECT r.* FROM auth_roles r
       JOIN auth_user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId]
    );

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isSystem: Boolean(row.is_system)
    }));
  }

  /**
   * Get user permissions (through roles)
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const rows = await this.db.query<any>(
      `SELECT DISTINCT p.* FROM auth_permissions p
       JOIN auth_role_permissions rp ON p.id = rp.permission_id
       JOIN auth_user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId]
    );

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      resource: row.resource,
      action: row.action,
      description: row.description
    }));
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(
    userId: string, 
    resource: string, 
    action: string
  ): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM auth_permissions p
       JOIN auth_role_permissions rp ON p.id = rp.permission_id
       JOIN auth_user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = ? AND p.resource = ? AND p.action = ?`,
      [userId, resource, action]
    );

    return result[0].count > 0;
  }

  /**
   * Check if user has a specific role
   */
  async hasRole(userId: string, roleName: string): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM auth_user_roles ur
       JOIN auth_roles r ON ur.role_id = r.id
       WHERE ur.user_id = ? AND r.name = ?`,
      [userId, roleName]
    );

    return result[0].count > 0;
  }

  /**
   * Check if this would be the first user
   */
  private async isFirstUser(): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM auth_users'
    );
    return result[0].count === 0;
  }

  /**
   * Create a session
   */
  async createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<string> {
    const sessionId = randomUUID();
    
    await this.db.execute(
      `INSERT INTO auth_sessions 
       (id, user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        userId,
        tokenHash,
        expiresAt.toISOString(),
        metadata?.ipAddress,
        metadata?.userAgent
      ]
    );

    return sessionId;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    await this.db.execute(
      `DELETE FROM auth_sessions WHERE expires_at < datetime('now')`
    );
    
    // Return number of deleted sessions
    return 0; // SQLite doesn't easily return affected rows
  }
}