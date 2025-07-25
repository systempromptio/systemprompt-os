/**
 * Role management service
 */

import type { RoleRepository } from '../repositories/role.repository.js';
import type { PermissionRepository } from '../repositories/permission.repository.js';
import type { AuditService } from './audit.service.js';
import type { Role, RoleCreateInput, RoleUpdateInput, Permission } from '../types/index.js';
import type { Logger } from '../../../types.js';

export class RoleService {
  constructor(
    private readonly roleRepo: RoleRepository,
    private readonly permissionRepo: PermissionRepository,
    private readonly auditService: AuditService,
    private readonly logger: Logger,
  ) {}

  /**
   * List all roles
   */
  async listRoles(): Promise<Role[]> {
    try {
      return await this.roleRepo.findAll();
    } catch (error) {
      this.logger.error('Failed to list roles', error);
      throw new Error('Failed to list roles');
    }
  }

  /**
   * Get role by ID or name
   */
  async getRole(idOrName: string): Promise<Role | null> {
    try {
      // Try by ID first
      let role = await this.roleRepo.findById(idOrName);

      // If not found, try by name
      if (!role) {
        role = await this.roleRepo.findByName(idOrName);
      }

      return role;
    } catch (error) {
      this.logger.error('Failed to get role', { idOrName, error });
      throw new Error('Failed to get role');
    }
  }

  /**
   * Create a new role
   */
  async createRole(input: RoleCreateInput, createdBy?: string): Promise<Role> {
    try {
      // Validate role name
      if (!this.isValidRoleName(input.name)) {
        throw new Error('Invalid role name. Use only letters, numbers, hyphens, and underscores.');
      }

      // Check if role already exists
      const existing = await this.roleRepo.findByName(input.name);
      if (existing) {
        throw new Error(`Role '${input.name}' already exists`);
      }

      // Create role
      const role = await this.roleRepo.create(input);

      // Grant initial permissions if provided
      if (input.permissions && input.permissions.length > 0) {
        for (const perm of input.permissions) {
          const grantInput: Parameters<typeof this.permissionRepo.grantPermission>[0] = {
            targetId: role.id,
            targetType: 'role',
            resource: perm.resource,
            action: perm.action,
          };
          if (perm.scope) {
            grantInput.scope = perm.scope;
          }
          if (createdBy) {
            grantInput.grantedBy = createdBy;
          }
          await this.permissionRepo.grantPermission(grantInput);
        }
      }

      // Audit
      await this.auditService.recordAudit({
        userId: createdBy || 'system',
        targetType: 'role',
        targetId: role.id,
        action: 'create_role',
        details: { name: role.name },
      });

      this.logger.info('Role created', { roleId: role.id, name: role.name, createdBy });

      return role;
    } catch (error) {
      this.logger.error('Failed to create role', { input, error });
      throw error;
    }
  }

  /**
   * Update role
   */
  async updateRole(idOrName: string, input: RoleUpdateInput, updatedBy?: string): Promise<Role> {
    try {
      const role = await this.getRole(idOrName);
      if (!role) {
        throw new Error('Role not found');
      }

      // Validate new name if provided
      if (input.name && !this.isValidRoleName(input.name)) {
        throw new Error('Invalid role name');
      }

      // Check if new name already exists
      if (input.name && input.name !== role.name) {
        const existing = await this.roleRepo.findByName(input.name);
        if (existing) {
          throw new Error(`Role '${input.name}' already exists`);
        }
      }

      const updated = await this.roleRepo.update(role.id, input);
      if (!updated) {
        throw new Error('Failed to update role');
      }

      // Audit
      await this.auditService.recordAudit({
        userId: updatedBy || 'system',
        targetType: 'role',
        targetId: role.id,
        action: 'update_role',
        details: input as Record<string, unknown>,
      });

      this.logger.info('Role updated', { roleId: role.id, updates: input, updatedBy });

      return updated;
    } catch (error) {
      this.logger.error('Failed to update role', { idOrName, input, error });
      throw error;
    }
  }

  /**
   * Delete role
   */
  async deleteRole(idOrName: string, deletedBy?: string): Promise<void> {
    try {
      const role = await this.getRole(idOrName);
      if (!role) {
        throw new Error('Role not found');
      }

      // Check if role has members
      const membersCount = await this.roleRepo.getMembersCount(role.id);
      if (membersCount > 0) {
        throw new Error(`Cannot delete role with ${membersCount} members`);
      }

      const deleted = await this.roleRepo.delete(role.id);
      if (!deleted) {
        throw new Error('Failed to delete role');
      }

      // Audit
      await this.auditService.recordAudit({
        userId: deletedBy || 'system',
        targetType: 'role',
        targetId: role.id,
        action: 'delete_role',
        details: { name: role.name },
      });

      this.logger.info('Role deleted', { roleId: role.id, name: role.name, deletedBy });
    } catch (error) {
      this.logger.error('Failed to delete role', { idOrName, error });
      throw error;
    }
  }

  /**
   * Get role permissions
   */
  async getRolePermissions(idOrName: string): Promise<Permission[]> {
    try {
      const role = await this.getRole(idOrName);
      if (!role) {
        throw new Error('Role not found');
      }

      return await this.permissionRepo.getRolePermissions(role.id);
    } catch (error) {
      this.logger.error('Failed to get role permissions', { idOrName, error });
      throw error;
    }
  }

  /**
   * Validate role name
   */
  private isValidRoleName(name: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(name);
  }
}
