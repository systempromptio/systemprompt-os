/* eslint-disable
  logical-assignment-operators,
  @typescript-eslint/no-unnecessary-condition,
  @typescript-eslint/strict-boolean-expressions,
  systemprompt-os/no-block-comments
*/
/**
 * Permissions service implementation - manages roles and access control.
 * @file Permissions service implementation.
 * @module permissions/services
 * Provides business logic for permissions and role management.
 */

import { randomUUID } from 'crypto';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import { PermissionsRepository } from '@/modules/core/permissions/repositories/permissions-repository';
import {
  type IPermission,
  type IPermissionCheck,
  type IPermissionsService,
  type IRole
} from '@/modules/core/permissions/types/index';

/**
 * Service for managing permissions and roles.
 */
export class PermissionsService implements IPermissionsService {
  private static instance: PermissionsService;
  private readonly repository: PermissionsRepository;
  private logger?: ILogger;
  private initialized = false;

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    this.repository = PermissionsRepository.getInstance();
  }

  /**
   * Get singleton instance.
   * @returns The permissions service instance.
   */
  static getInstance(): PermissionsService {
    if (!PermissionsService.instance) {
      PermissionsService.instance = new PermissionsService();
    }
    return PermissionsService.instance;
  }

  /**
   * Set logger instance.
   * @param logger - The logger instance to use.
   */
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * Initialize service.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.repository.initialize();
    await this.initializeDefaultRoles();
    this.initialized = true;
    this.logger?.info(LogSource.PERMISSIONS, 'PermissionsService initialized');
  }

  /**
   * Create a new permission.
   * @param name - The permission name.
   * @param resource - The resource identifier.
   * @param action - The action identifier.
   * @param description - Optional description.
   * @returns Promise that resolves to the created permission.
   */
  async createPermission(
    name: string,
    resource: string,
    action: string,
    description?: string
  ): Promise<IPermission> {
    await this.ensureInitialized();

    const id = randomUUID();
    this.logger?.info(LogSource.PERMISSIONS, `Creating permission: ${name} (${resource}:${action})`);

    const permission = await this.repository.createPermission(
      description !== undefined
        ? {
 id,
name,
resource,
action,
description
}
        : {
 id,
name,
resource,
action
}
    );
    this.logger?.info(LogSource.PERMISSIONS, `Created permission: ${id}`);

    return permission;
  }

  /**
   * Get permission by ID.
   * @param id - The permission ID.
   * @returns Promise that resolves to the permission or null if not found.
   */
  async getPermission(id: string): Promise<IPermission | null> {
    await this.ensureInitialized();
    return await this.repository.findPermissionById(id);
  }

  /**
   * List all permissions.
   * @returns Promise that resolves to array of permissions.
   */
  async listPermissions(): Promise<IPermission[]> {
    await this.ensureInitialized();
    return await this.repository.findAllPermissions();
  }

  /**
   * Create a new role.
   * @param name - The role name.
   * @param description - Optional description.
   * @returns Promise that resolves to the created role.
   */
  async createRole(name: string, description?: string): Promise<IRole> {
    await this.ensureInitialized();

    const id = randomUUID();
    this.logger?.info(LogSource.PERMISSIONS, `Creating role: ${name}`);

    const role = await this.repository.createRole(
      description !== undefined
        ? {
 id,
name,
description,
isSystem: false
}
        : {
 id,
name,
isSystem: false
}
    );
    this.logger?.info(LogSource.PERMISSIONS, `Created role: ${id}`);

    return role;
  }

  /**
   * Get role by ID.
   * @param id - The role ID.
   * @returns Promise that resolves to the role or null if not found.
   */
  async getRole(id: string): Promise<IRole | null> {
    await this.ensureInitialized();
    return await this.repository.findRoleById(id);
  }

  /**
   * List all roles.
   * @returns Promise that resolves to array of roles.
   */
  async listRoles(): Promise<IRole[]> {
    await this.ensureInitialized();
    return await this.repository.findAllRoles();
  }

  /**
   * Grant permission to a role.
   * @param roleId - The role ID.
   * @param permissionId - The permission ID.
   * @returns Promise that resolves when granted.
   */
  async grantPermission(roleId: string, permissionId: string): Promise<void> {
    await this.ensureInitialized();

    const role = await this.repository.findRoleById(roleId);
    if (role === null) {
      throw new Error(`Role not found: ${roleId}`);
    }

    const permission = await this.repository.findPermissionById(permissionId);
    if (permission === null) {
      throw new Error(`Permission not found: ${permissionId}`);
    }

    this.logger?.info(LogSource.PERMISSIONS, `Granting permission ${permissionId} to role ${roleId}`);
    await this.repository.grantPermissionToRole(roleId, permissionId);
  }

  /**
   * Revoke permission from a role.
   * @param roleId - The role ID.
   * @param permissionId - The permission ID.
   * @returns Promise that resolves when revoked.
   */
  async revokePermission(roleId: string, permissionId: string): Promise<void> {
    await this.ensureInitialized();

    this.logger?.info(LogSource.PERMISSIONS, `Revoking permission ${permissionId} from role ${roleId}`);
    await this.repository.revokePermissionFromRole(roleId, permissionId);
  }

  /**
   * Assign role to a user.
   * @param userId - The user ID.
   * @param roleId - The role ID.
   * @param expiresAt - Optional expiration date.
   * @returns Promise that resolves when assigned.
   */
  async assignRole(userId: string, roleId: string, expiresAt?: Date): Promise<void> {
    await this.ensureInitialized();

    const role = await this.repository.findRoleById(roleId);
    if (role === null) {
      throw new Error(`Role not found: ${roleId}`);
    }

    this.logger?.info(LogSource.PERMISSIONS, `Assigning role ${roleId} to user ${userId}`);
    await this.repository.assignRoleToUser(
      expiresAt !== undefined
        ? {
 userId,
roleId,
expiresAt
}
        : {
 userId,
roleId
}
    );
  }

  /**
   * Remove role from a user.
   * @param userId - The user ID.
   * @param roleId - The role ID.
   * @returns Promise that resolves when removed.
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    await this.ensureInitialized();

    this.logger?.info(LogSource.PERMISSIONS, `Removing role ${roleId} from user ${userId}`);
    await this.repository.removeRoleFromUser(userId, roleId);
  }

  /**
   * Check if user has permission.
   * @param userId - The user ID.
   * @param resource - The resource identifier.
   * @param action - The action identifier.
   * @returns Promise that resolves to permission check result.
   */
  async checkPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<IPermissionCheck> {
    await this.ensureInitialized();

    const userRoles = await this.repository.findUserRoles(userId);

    for (const userRole of userRoles) {
      const permissions = await this.repository.findRolePermissions(userRole.roleId);

      for (const permission of permissions) {
        if (permission.resource === resource && permission.action === action) {
          return {
            allowed: true,
            role: userRole.roleId,
            permission: permission.id
          };
        }
      }
    }

    return {
      allowed: false,
      reason: `No permission for ${resource}:${action}`
    };
  }

  /**
   * Get user's roles.
   * @param userId - The user ID.
   * @returns Promise that resolves to array of roles.
   */
  async getUserRoles(userId: string): Promise<IRole[]> {
    await this.ensureInitialized();

    const userRoles = await this.repository.findUserRoles(userId);
    const roles: IRole[] = [];

    for (const userRole of userRoles) {
      const role = await this.repository.findRoleById(userRole.roleId);
      if (role !== null) {
        roles.push(role);
      }
    }

    return roles;
  }

  /**
   * Get role's permissions.
   * @param roleId - The role ID.
   * @returns Promise that resolves to array of permissions.
   */
  async getRolePermissions(roleId: string): Promise<IPermission[]> {
    await this.ensureInitialized();
    return await this.repository.findRolePermissions(roleId);
  }

  /**
   * Initialize default roles.
   * @returns Promise that resolves when initialized.
   */
  private async initializeDefaultRoles(): Promise<void> {
    const adminRole = await this.repository.findRoleByName('admin');
    if (adminRole === null) {
      await this.repository.createRole({
        id: randomUUID(),
        name: 'admin',
        description: 'System administrator role',
        isSystem: true
      });
    }

    const userRole = await this.repository.findRoleByName('user');
    if (userRole === null) {
      await this.repository.createRole({
        id: randomUUID(),
        name: 'user',
        description: 'Default user role',
        isSystem: true
      });
    }
  }

  /**
   * Ensure service is initialized.
   * @returns Promise that resolves when initialized.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
