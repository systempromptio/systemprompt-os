/**
 * @fileoverview Permissions module - Fine-grained permission management
 * @module modules/core/permissions
 */

import { Service, Inject } from 'typedi';
import type { GlobalConfiguration } from '@/modules/core/config/types/index.js';
import type { IModule } from '@/modules/core/modules/types/index.js';
import { ModuleStatus } from '@/modules/core/modules/types/index.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { TYPES } from '@/modules/core/types.js';
import { RoleRepository } from './repositories/role.repository.js';
import { PermissionRepository } from './repositories/permission.repository.js';
import { RoleService } from './services/role.service.js';
import { PermissionService } from './services/permission.service.js';
import { UserRoleService } from './services/user-role.service.js';
import { AuditService } from './services/audit.service.js';
import type {
  Role,
  Permission,
  PermissionCheck,
  PermissionResult,
  PermissionGrantInput,
  PermissionFilter,
  RoleCreateInput,
  RoleUpdateInput,
  PermissionScope,
  PermissionAuditEntry,
} from './types/index.js';

@Service()
export class PermissionsModule implements IModule {
  name = 'permissions';
  version = '1.0.0';
  type = 'service' as const;
  status = ModuleStatus.STOPPED;

  private config: any;
  private roleService!: RoleService;
  private permissionService!: PermissionService;
  private userRoleService!: UserRoleService;
  private auditService!: AuditService;

  constructor(
    @Inject(TYPES.Logger) private readonly logger: ILogger,
    @Inject(TYPES.Config) private readonly globalConfig: GlobalConfiguration,
  ) {}

  async initialize(): Promise<void> {
    this.config = this.globalConfig?.modules?.['permissions'] || {};

    // Initialize repositories
    const roleRepo = new RoleRepository(this.logger);
    const permissionRepo = new PermissionRepository(this.logger);

    // Initialize services
    this.auditService = new AuditService(this.logger);
    this.userRoleService = new UserRoleService(this.auditService, this.logger);
    this.roleService = new RoleService(roleRepo, permissionRepo, this.auditService, this.logger);
    this.permissionService = new PermissionService(
      permissionRepo,
      this.userRoleService,
      this.auditService,
      this.config.defaultPermissions || {},
      this.logger,
    );

    this.logger.info('Permissions module initialized');
  }

  async start(): Promise<void> {
    // Module doesn't need startup actions
    this.logger.info('Permissions module started');
  }

  async stop(): Promise<void> {
    // Module doesn't manage database connections
    this.logger.info('Permissions module stopped');
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Try to list roles as a health check
      await this.roleService.listRoles();

      return {
        healthy: true,
        message: 'Permissions module is healthy',
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Permissions module health check failed: ${error}`,
      };
    }
  }

  // Permission management methods

  /**
   * Check if user has permission
   */
  async checkPermission(check: PermissionCheck): Promise<PermissionResult> {
    return this.permissionService.checkPermission(check);
  }

  /**
   * Grant permission
   */
  async grantPermission(input: PermissionGrantInput): Promise<void> {
    return this.permissionService.grantPermission(input);
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
    revokedBy?: string,
  ): Promise<void> {
    return this.permissionService.revokePermission(
      targetId,
      targetType,
      resource,
      action,
      scope,
      revokedBy,
    );
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    return this.permissionService.getUserPermissions(userId);
  }

  /**
   * List permissions
   */
  async listPermissions(filter?: PermissionFilter): Promise<Permission[]> {
    return this.permissionService.listPermissions(filter);
  }

  // Role management methods

  /**
   * List all roles
   */
  async listRoles(): Promise<Role[]> {
    return this.roleService.listRoles();
  }

  /**
   * Get role
   */
  async getRole(idOrName: string): Promise<Role | null> {
    return this.roleService.getRole(idOrName);
  }

  /**
   * Create role
   */
  async createRole(input: RoleCreateInput, createdBy?: string): Promise<Role> {
    return this.roleService.createRole(input, createdBy);
  }

  /**
   * Update role
   */
  async updateRole(idOrName: string, input: RoleUpdateInput, updatedBy?: string): Promise<Role> {
    return this.roleService.updateRole(idOrName, input, updatedBy);
  }

  /**
   * Delete role
   */
  async deleteRole(idOrName: string, deletedBy?: string): Promise<void> {
    return this.roleService.deleteRole(idOrName, deletedBy);
  }

  /**
   * Get role permissions
   */
  async getRolePermissions(idOrName: string): Promise<Permission[]> {
    return this.roleService.getRolePermissions(idOrName);
  }

  // User role management methods

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string, assignedBy?: string): Promise<void> {
    return this.userRoleService.assignRole(userId, roleId, assignedBy);
  }

  /**
   * Remove role from user
   */
  async unassignRole(userId: string, roleId: string, unassignedBy?: string): Promise<void> {
    return this.userRoleService.unassignRole(userId, roleId, unassignedBy);
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    return this.userRoleService.getUserRoles(userId);
  }

  /**
   * Get role members
   */
  async getRoleMembers(roleId: string): Promise<any[]> {
    return this.userRoleService.getRoleMembers(roleId);
  }

  // Audit methods

  /**
   * Get audit entries
   */
  async getAuditEntries(filters?: any): Promise<PermissionAuditEntry[]> {
    return this.auditService.getAuditEntries(filters);
  }

  /**
   * Get CLI command for this module
   */
  async getCommand(): Promise<any> {
    const { createPermissionsCommand } = await import('./cli/index.js');
    return createPermissionsCommand(this);
  }

  // Lifecycle hooks

  /**
   * Handle user created event
   */
  async onUserCreated(userId: string): Promise<void> {
    try {
      // Assign default 'user' role
      const userRole = await this.roleService.getRole('user');
      if (userRole) {
        await this.userRoleService.assignRole(userId, userRole.id);
        this.logger.info('Default role assigned to new user', { userId });
      }
    } catch (error) {
      this.logger.error('Failed to assign default role', { userId, error });
    }
  }

  /**
   * Handle user deleted event
   */
  async onUserDeleted(userId: string): Promise<void> {
    try {
      // Remove all user roles
      await this.userRoleService.removeAllUserRoles(userId);
      this.logger.info('User permissions cleaned up', { userId });
    } catch (error) {
      this.logger.error('Failed to cleanup user permissions', { userId, error });
    }
  }
}

// Export for dynamic loading
export default PermissionsModule;
