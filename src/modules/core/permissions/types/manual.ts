/**
 * Permission action enumeration.
 */
export const enum PermissionActionEnum {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
  MANAGE = 'manage'
}

/**
 * Permission check result.
 */
export interface IPermissionCheck {
  allowed: boolean;
  role?: string;
  permission?: string;
  reason?: string;
}

/**
 * CLI command options for roles management.
 */
export interface RolesCommandOptions {
  list?: boolean;
  create?: string;
  description?: string;
}

/**
 * CLI command options for granting permissions.
 */
export interface GrantCommandOptions {
  role: string;
  permission: string;
}

/**
 * CLI command options for listing permissions.
 */
export interface ListCommandOptions {
  format?: string;
}
