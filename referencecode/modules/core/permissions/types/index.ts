/**
 * Permissions module type definitions
 */

export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: number;
  resource: string;
  action: string;
  scope?: PermissionScope;
  description?: string;
  createdAt: Date;
}

export type PermissionScope = 'self' | 'all' | 'team' | 'organization';

export interface UserRole {
  userId: string;
  roleId: string;
  assignedAt: Date;
  assignedBy?: string;
}

export interface RolePermission {
  roleId: string;
  permissionId: number;
  conditions?: PermissionConditions;
  grantedAt: Date;
  grantedBy?: string;
}

export interface UserPermission {
  userId: string;
  permissionId: number;
  conditions?: PermissionConditions;
  grantedAt: Date;
  grantedBy?: string;
  expiresAt?: Date;
}

export interface PermissionConditions {
  ipRange?: string[];
  timeRange?: {
    start: string; // HH:MM
    end: string;   // HH:MM
  };
  dayOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  custom?: Record<string, unknown>;
}

export interface PermissionCheck {
  userId: string;
  resource: string;
  action: string;
  scope?: PermissionScope;
  context?: PermissionContext;
}

export interface PermissionContext {
  ipAddress?: string;
  timestamp?: Date;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  matchedBy?: 'role' | 'direct' | 'default';
  conditions?: PermissionConditions;
}

export interface RoleCreateInput {
  name: string;
  description?: string;
  permissions?: Array<{
    resource: string;
    action: string;
    scope?: PermissionScope;
  }>;
}

export interface RoleUpdateInput {
  name?: string;
  description?: string;
}

export interface PermissionGrantInput {
  targetId: string;
  targetType: 'user' | 'role';
  resource: string;
  action: string;
  scope?: PermissionScope;
  conditions?: PermissionConditions;
  expiresAt?: Date;
  grantedBy?: string;
}

export interface PermissionFilter {
  userId?: string;
  roleId?: string;
  resource?: string;
  action?: string;
  scope?: PermissionScope;
}

export interface PermissionAuditEntry {
  id: number;
  userId?: string;
  targetType: 'user' | 'role';
  targetId: string;
  action: AuditAction;
  resource?: string;
  permissionAction?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export type AuditAction = 
  | 'grant'
  | 'revoke'
  | 'create_role'
  | 'update_role'
  | 'delete_role'
  | 'assign_role'
  | 'unassign_role';

export interface PermissionStats {
  totalRoles: number;
  totalPermissions: number;
  totalGrants: number;
  usersByRole: Record<string, number>;
  permissionsByResource: Record<string, number>;
}

export interface ResourceDefinition {
  name: string;
  actions: string[];
  scopes?: PermissionScope[];
  description?: string;
}