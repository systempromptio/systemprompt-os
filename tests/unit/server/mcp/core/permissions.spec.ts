/**
 * @fileoverview Unit tests for MCP permission system
 */

import { describe, it, expect } from 'vitest';
import { hasPermission, ROLE_PERMISSIONS } from '@/server/mcp/core/types/permissions';
import type { UserPermissionContext } from '@/server/mcp/core/types/permissions';

describe('Permission System', () => {
  describe('hasPermission', () => {
    it('should return true for exact permission match', () => {
      const context: UserPermissionContext = {
        userId: 'user-123',
        email: 'admin@example.com',
        role: 'admin',
        permissions: ['system:read', 'admin:status']
      };
      
      expect(hasPermission(context, 'system:read')).toBe(true);
      expect(hasPermission(context, 'admin:status')).toBe(true);
    });

    it('should return false for missing permission', () => {
      const context: UserPermissionContext = {
        userId: 'user-123',
        email: 'basic@example.com',
        role: 'basic',
        permissions: ['system:read:basic']
      };
      
      expect(hasPermission(context, 'admin:status')).toBe(false);
      expect(hasPermission(context, 'system:write')).toBe(false);
    });

    it('should handle wildcard permissions', () => {
      const context: UserPermissionContext = {
        userId: 'user-123',
        email: 'admin@example.com',
        role: 'admin',
        permissions: ['admin:*']
      };
      
      expect(hasPermission(context, 'admin:status')).toBe(true);
      expect(hasPermission(context, 'admin:create')).toBe(true);
      expect(hasPermission(context, 'admin:delete')).toBe(true);
      expect(hasPermission(context, 'system:read')).toBe(false);
    });

    it('should handle super admin wildcard', () => {
      const context: UserPermissionContext = {
        userId: 'user-123',
        email: 'superadmin@example.com',
        role: 'admin',
        permissions: ['*:*']
      };
      
      expect(hasPermission(context, 'admin:status')).toBe(true);
      expect(hasPermission(context, 'system:write')).toBe(true);
      expect(hasPermission(context, 'container:delete')).toBe(true);
    });

    it('should include custom permissions', () => {
      const context: UserPermissionContext = {
        userId: 'user-123',
        email: 'basic@example.com',
        role: 'basic',
        permissions: ['system:read:basic'],
        customPermissions: ['container:create', 'admin:status']
      };
      
      expect(hasPermission(context, 'system:read:basic')).toBe(true);
      expect(hasPermission(context, 'container:create')).toBe(true);
      expect(hasPermission(context, 'admin:status')).toBe(true);
      expect(hasPermission(context, 'admin:delete')).toBe(false);
    });
  });

  describe('ROLE_PERMISSIONS', () => {
    it('should define admin role with full permissions', () => {
      const adminPerms = ROLE_PERMISSIONS.admin;
      
      expect(adminPerms).toContain('system:read');
      expect(adminPerms).toContain('system:write');
      expect(adminPerms).toContain('admin:*');
      expect(adminPerms).toContain('container:*');
      expect(adminPerms).toContain('user:*');
      expect(adminPerms).toContain('audit:read');
    });

    it('should define basic role with limited permissions', () => {
      const basicPerms = ROLE_PERMISSIONS.basic;
      
      expect(basicPerms).toContain('system:read:basic');
      expect(basicPerms).toContain('container:read:own');
      expect(basicPerms).toContain('user:read:self');
      expect(basicPerms).not.toContain('system:write');
      expect(basicPerms).not.toContain('admin:*');
    });
  });
});