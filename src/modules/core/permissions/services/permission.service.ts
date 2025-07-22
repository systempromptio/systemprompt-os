/**
 * Permission management service
 */

import type { PermissionRepository } from '../repositories/permission.repository.js';
import type { UserRoleService } from './user-role.service.js';
import type { AuditService } from './audit.service.js';
import type { 
  Permission,
  PermissionCheck,
  PermissionResult,
  PermissionGrantInput,
  PermissionFilter,
  PermissionScope,
  PermissionContext
} from '../types/index.js';
import type { Logger } from '../../../types.js';

export class PermissionService {
  constructor(
    private permissionRepo: PermissionRepository,
    private userRoleService: UserRoleService,
    private auditService: AuditService,
    private defaultPermissions: Record<string, Array<{resource: string; actions: string[]}>>,
    private logger: Logger
  ) {}
  
  /**
   * Check if user has permission
   */
  async checkPermission(check: PermissionCheck): Promise<PermissionResult> {
    try {
      // Check direct permissions and role permissions
      const hasPermission = await this.permissionRepo.checkUserPermission(
        check.userId,
        check.resource,
        check.action,
        check.scope
      );
      
      if (hasPermission) {
        return {
          allowed: true,
          matchedBy: 'role' // Could be direct or role
        };
      }
      
      // Check default permissions based on user roles
      const roles = await this.userRoleService.getUserRoles(check.userId);
      for (const role of roles) {
        const defaults = this.defaultPermissions[role.name];
        if (defaults) {
          for (const def of defaults) {
            if (def.resource === check.resource || def.resource === '*') {
              if (def.actions.includes(check.action) || def.actions.includes('*')) {
                return {
                  allowed: true,
                  matchedBy: 'default'
                };
              }
            }
          }
        }
      }
      
      // Check guest permissions if no roles
      if (roles.length === 0) {
        const guestDefaults = this.defaultPermissions.guest;
        if (guestDefaults) {
          for (const def of guestDefaults) {
            if (def.resource === check.resource) {
              if (def.actions.includes(check.action)) {
                return {
                  allowed: true,
                  matchedBy: 'default'
                };
              }
            }
          }
        }
      }
      
      return {
        allowed: false,
        reason: `No permission for ${check.action} on ${check.resource}`
      };
    } catch (error) {
      this.logger.error('Failed to check permission', { check, error });
      throw new Error('Failed to check permission');
    }
  }
  
  /**
   * Grant permission
   */
  async grantPermission(input: PermissionGrantInput): Promise<void> {
    try {
      // Validate target exists
      if (input.targetType === 'role') {
        const roleExists = await this.userRoleService.roleExists(input.targetId);
        if (!roleExists) {
          throw new Error('Role not found');
        }
      } else {
        // TODO: Validate user exists when users module is available
      }
      
      await this.permissionRepo.grantPermission(input);
      
      // Permission granted successfully
      
      // Audit
      await this.auditService.recordAudit({
        userId: input.grantedBy,
        targetType: input.targetType,
        targetId: input.targetId,
        action: 'grant',
        resource: input.resource,
        permissionAction: input.action,
        details: {
          scope: input.scope,
          conditions: input.conditions,
          expiresAt: input.expiresAt
        }
      });
      
      this.logger.info('Permission granted', {
        targetType: input.targetType,
        targetId: input.targetId,
        resource: input.resource,
        action: input.action,
        grantedBy: input.grantedBy
      });
    } catch (error) {
      this.logger.error('Failed to grant permission', { input, error });
      throw error;
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
    scope?: PermissionScope,
    revokedBy?: string
  ): Promise<void> {
    try {
      const revoked = await this.permissionRepo.revokePermission(
        targetId,
        targetType,
        resource,
        action,
        scope
      );
      
      if (!revoked) {
        throw new Error('Permission not found');
      }
      
      // Permission revoked successfully
      
      // Audit
      await this.auditService.recordAudit({
        userId: revokedBy,
        targetType,
        targetId,
        action: 'revoke',
        resource,
        permissionAction: action,
        details: { scope }
      });
      
      this.logger.info('Permission revoked', {
        targetType,
        targetId,
        resource,
        action,
        revokedBy
      });
    } catch (error) {
      this.logger.error('Failed to revoke permission', { 
        targetId, 
        targetType, 
        resource, 
        action, 
        error 
      });
      throw error;
    }
  }
  
  /**
   * Get user permissions
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      return await this.permissionRepo.getUserPermissions(userId);
    } catch (error) {
      this.logger.error('Failed to get user permissions', { userId, error });
      throw new Error('Failed to get user permissions');
    }
  }
  
  /**
   * List permissions with filter
   */
  async listPermissions(filter?: PermissionFilter): Promise<Permission[]> {
    try {
      return await this.permissionRepo.listPermissions(filter);
    } catch (error) {
      this.logger.error('Failed to list permissions', { filter, error });
      throw new Error('Failed to list permissions');
    }
  }
  
  /**
   * Check permission with context
   */
  async checkPermissionWithContext(
    check: PermissionCheck,
    context: PermissionContext
  ): Promise<PermissionResult> {
    // For now, just use basic check
    // TODO: Implement context-aware permission checking
    return await this.checkPermission(check);
  }
  
}