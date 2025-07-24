/**
 * User role management service
 */

import { DatabaseService } from '../../database/services/database.service.js';
import type { AuditService } from './audit.service.js';
import type { Role, UserRole } from '../types/index.js';
import type { Logger } from '../../../types.js';

export class UserRoleService {
  private readonly db: DatabaseService;

  constructor(
    private readonly auditService: AuditService,
    private readonly logger: Logger,
  ) {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string, assignedBy?: string): Promise<void> {
    try {
      // Check if already assigned
      const existing = await this.db.query(
        'SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = ?',
        [userId, roleId],
      );

      if (existing.length > 0) {
        throw new Error('Role already assigned to user');
      }

      // Assign role
      await this.db.execute(
        `
        INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
        VALUES (?, ?, ?, ?)
      `,
        [userId, roleId, new Date().toISOString(), assignedBy],
      );

      // Audit
      await this.auditService.recordAudit({
        userId: assignedBy || 'system',
        targetType: 'user',
        targetId: userId,
        action: 'assign_role',
        details: { roleId },
      });

      this.logger.info('Role assigned to user', { userId, roleId, assignedBy });
    } catch (error) {
      this.logger.error('Failed to assign role', { userId, roleId, error });
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  async unassignRole(userId: string, roleId: string, unassignedBy?: string): Promise<void> {
    try {
      await this.db.execute('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [
        userId,
        roleId,
      ]);

      // Audit
      await this.auditService.recordAudit({
        userId: unassignedBy || 'system',
        targetType: 'user',
        targetId: userId,
        action: 'unassign_role',
        details: { roleId },
      });

      this.logger.info('Role removed from user', { userId, roleId, unassignedBy });
    } catch (error) {
      this.logger.error('Failed to unassign role', { userId, roleId, error });
      throw error;
    }
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    try {
      const rows = await this.db.query<any>(
        `
        SELECT r.*
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?
        ORDER BY r.name
      `,
        [userId],
      );

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        isSystem: Boolean(row.is_system),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));
    } catch (error) {
      this.logger.error('Failed to get user roles', { userId, error });
      throw new Error('Failed to get user roles');
    }
  }

  /**
   * Get role members
   */
  async getRoleMembers(roleId: string): Promise<UserRole[]> {
    try {
      const rows = await this.db.query<any>(
        `
        SELECT user_id, role_id, assigned_at, assigned_by
        FROM user_roles
        WHERE role_id = ?
        ORDER BY assigned_at DESC
      `,
        [roleId],
      );

      return rows.map((row) => ({
        userId: row.user_id,
        roleId: row.role_id,
        assignedAt: new Date(row.assigned_at),
        assignedBy: row.assigned_by,
      }));
    } catch (error) {
      this.logger.error('Failed to get role members', { roleId, error });
      throw new Error('Failed to get role members');
    }
  }

  /**
   * Check if user has role
   */
  async userHasRole(userId: string, roleId: string): Promise<boolean> {
    try {
      const result = await this.db.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM user_roles WHERE user_id = ? AND role_id = ?',
        [userId, roleId],
      );

      return (result[0]?.count || 0) > 0;
    } catch (error) {
      this.logger.error('Failed to check user role', { userId, roleId, error });
      throw new Error('Failed to check user role');
    }
  }

  /**
   * Check if role exists
   */
  async roleExists(roleId: string): Promise<boolean> {
    try {
      const result = await this.db.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM roles WHERE id = ? OR name = ?',
        [roleId, roleId],
      );

      return (result[0]?.count || 0) > 0;
    } catch (error) {
      this.logger.error('Failed to check role exists', { roleId, error });
      throw new Error('Failed to check role exists');
    }
  }

  /**
   * Remove all roles from user
   */
  async removeAllUserRoles(userId: string): Promise<void> {
    try {
      await this.db.execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);

      this.logger.info('All roles removed from user', { userId });
    } catch (error) {
      this.logger.error('Failed to remove user roles', { userId, error });
      throw error;
    }
  }
}
