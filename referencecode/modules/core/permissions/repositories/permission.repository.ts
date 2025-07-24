/**
 * Permission repository implementation
 */

import { BaseRepository } from './base.repository.js';
import type { 
  Permission, 
  UserPermission, 
  RolePermission, 
  PermissionGrantInput,
  PermissionFilter,
  PermissionScope
} from '../types/index.js';
import type { Logger } from '../../../types.js';

export class PermissionRepository extends BaseRepository {
  constructor(logger: Logger) {
    super(logger);
  }
  
  /**
   * Find or create permission
   */
  async findOrCreatePermission(
    resource: string, 
    action: string, 
    scope?: PermissionScope
  ): Promise<Permission> {
    // Try to find existing
    let permission = await this.get<any>(`
      SELECT * FROM permissions 
      WHERE resource = ? AND action = ? AND (scope = ? OR (scope IS NULL AND ? IS NULL))
    `, [resource, action, scope, scope]);
    
    if (!permission) {
      // Create new permission
      await this.run(`
        INSERT INTO permissions (resource, action, scope, created_at)
        VALUES (?, ?, ?, ?)
      `, [resource, action, scope, new Date().toISOString()]);
      
      permission = await this.get<any>(`
        SELECT * FROM permissions 
        WHERE resource = ? AND action = ? AND (scope = ? OR (scope IS NULL AND ? IS NULL))
      `, [resource, action, scope, scope]);
    }
    
    return this.mapRowToPermission(permission);
  }
  
  /**
   * Grant permission
   */
  async grantPermission(input: PermissionGrantInput): Promise<void> {
    const permission = await this.findOrCreatePermission(
      input.resource,
      input.action,
      input.scope
    );
    
    if (input.targetType === 'role') {
      const rolePermData: Parameters<typeof this.grantRolePermission>[0] = {
        roleId: input.targetId,
        permissionId: permission.id,
        grantedAt: new Date()
      };
      if (input.conditions) {
        rolePermData.conditions = input.conditions;
      }
      if (input.grantedBy) {
        rolePermData.grantedBy = input.grantedBy;
      }
      await this.grantRolePermission(rolePermData);
    } else {
      const userPermData: Parameters<typeof this.grantUserPermission>[0] = {
        userId: input.targetId,
        permissionId: permission.id,
        grantedAt: new Date()
      };
      if (input.conditions) {
        userPermData.conditions = input.conditions;
      }
      if (input.grantedBy) {
        userPermData.grantedBy = input.grantedBy;
      }
      if (input.expiresAt) {
        userPermData.expiresAt = input.expiresAt;
      }
      await this.grantUserPermission(userPermData);
    }
  }
  
  /**
   * Revoke permission
   */
  async revokePermission(
    targetId: string,
    targetType: 'user' | 'role',
    resource: string,
    action: string,
    scope?: PermissionScope
  ): Promise<boolean> {
    const permission = await this.get<any>(`
      SELECT id FROM permissions 
      WHERE resource = ? AND action = ? AND (scope = ? OR (scope IS NULL AND ? IS NULL))
    `, [resource, action, scope, scope]);
    
    if (!permission) {
      return false;
    }
    
    if (targetType === 'role') {
      await this.run(
        'DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?',
        [targetId, permission.id]
      );
    } else {
      await this.run(
        'DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?',
        [targetId, permission.id]
      );
    }
    
    this.logger.info('Permission revoked', { 
      targetId, 
      targetType, 
      resource, 
      action, 
      scope 
    });
    
    return true;
  }
  
  /**
   * Get user permissions (including from roles)
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const rows = await this.query<any>(`
      -- Direct user permissions
      SELECT DISTINCT p.*
      FROM permissions p
      JOIN user_permissions up ON p.id = up.permission_id
      WHERE up.user_id = ? 
        AND (up.expires_at IS NULL OR up.expires_at > datetime('now'))
      
      UNION
      
      -- Permissions from roles
      SELECT DISTINCT p.*
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ?
      
      ORDER BY resource, action
    `, [userId, userId]);
    
    return rows.map(this.mapRowToPermission);
  }
  
  /**
   * Get role permissions
   */
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const rows = await this.query<any>(`
      SELECT p.*
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.resource, p.action
    `, [roleId]);
    
    return rows.map(this.mapRowToPermission);
  }
  
  /**
   * Check if user has permission
   */
  async checkUserPermission(
    userId: string,
    resource: string,
    action: string,
    scope?: PermissionScope
  ): Promise<boolean> {
    const result = await this.get<{ count: number }>(`
      SELECT COUNT(*) as count FROM (
        -- Direct user permissions
        SELECT 1
        FROM permissions p
        JOIN user_permissions up ON p.id = up.permission_id
        WHERE up.user_id = ? 
          AND p.resource = ?
          AND p.action = ?
          AND (p.scope = ? OR p.scope IS NULL OR ? IS NULL)
          AND (up.expires_at IS NULL OR up.expires_at > datetime('now'))
        
        UNION
        
        -- Permissions from roles
        SELECT 1
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = ?
          AND p.resource = ?
          AND p.action = ?
          AND (p.scope = ? OR p.scope IS NULL OR ? IS NULL)
      )
    `, [
      userId, resource, action, scope, scope,
      userId, resource, action, scope, scope
    ]);
    
    return (result?.count || 0) > 0;
  }
  
  /**
   * List all permissions with filter
   */
  async listPermissions(filter?: PermissionFilter): Promise<Permission[]> {
    let sql = `
      SELECT DISTINCT p.*
      FROM permissions p
    `;
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (filter?.userId) {
      sql += `
        LEFT JOIN user_permissions up ON p.id = up.permission_id
        LEFT JOIN role_permissions rp ON p.id = rp.permission_id
        LEFT JOIN user_roles ur ON rp.role_id = ur.role_id
      `;
      conditions.push('(up.user_id = ? OR ur.user_id = ?)');
      params.push(filter.userId, filter.userId);
    }
    
    if (filter?.roleId) {
      if (!filter.userId) {
        sql += ' LEFT JOIN role_permissions rp ON p.id = rp.permission_id';
      }
      conditions.push('rp.role_id = ?');
      params.push(filter.roleId);
    }
    
    if (filter?.resource) {
      conditions.push('p.resource = ?');
      params.push(filter.resource);
    }
    
    if (filter?.action) {
      conditions.push('p.action = ?');
      params.push(filter.action);
    }
    
    if (filter?.scope) {
      conditions.push('p.scope = ?');
      params.push(filter.scope);
    }
    
    if (conditions.length > 0) {
      sql += ` WHERE ${  conditions.join(' AND ')}`;
    }
    
    sql += ' ORDER BY p.resource, p.action';
    
    const rows = await this.query<any>(sql, params);
    return rows.map(this.mapRowToPermission);
  }
  
  /**
   * Grant role permission
   */
  private async grantRolePermission(permission: RolePermission): Promise<void> {
    await this.run(`
      INSERT OR REPLACE INTO role_permissions 
      (role_id, permission_id, conditions, granted_at, granted_by)
      VALUES (?, ?, ?, ?, ?)
    `, [
      permission.roleId,
      permission.permissionId,
      permission.conditions ? JSON.stringify(permission.conditions) : null,
      permission.grantedAt.toISOString(),
      permission.grantedBy
    ]);
  }
  
  /**
   * Grant user permission
   */
  private async grantUserPermission(permission: UserPermission): Promise<void> {
    await this.run(`
      INSERT OR REPLACE INTO user_permissions 
      (user_id, permission_id, conditions, granted_at, granted_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      permission.userId,
      permission.permissionId,
      permission.conditions ? JSON.stringify(permission.conditions) : null,
      permission.grantedAt.toISOString(),
      permission.grantedBy,
      permission.expiresAt?.toISOString()
    ]);
  }
  
  /**
   * Map database row to Permission object
   */
  private mapRowToPermission(row: any): Permission {
    const permission: Permission = {
      id: row.id,
      resource: row.resource,
      action: row.action,
      description: row.description,
      createdAt: new Date(row.created_at)
    };
    if (row.scope) {
      permission.scope = row.scope as PermissionScope;
    }
    return permission;
  }
}