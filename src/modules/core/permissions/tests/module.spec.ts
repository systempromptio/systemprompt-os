/**
 * Permissions module tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PermissionsModule } from '../../../src/modules/core/permissions/index.js';
import { DatabaseService } from '../../../src/modules/core/database/services/database.service.js';
import type { Role, Permission, PermissionCheck } from '../../../src/modules/core/permissions/types/index.js';

// Mock the database service
const mockDb = {
  query: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
  isInitialized: vi.fn().mockReturnValue(true)
};

vi.mock('../../../src/modules/core/database/services/database.service.js', () => {
  return {
    DatabaseService: {
      getInstance: vi.fn(() => mockDb),
      initialize: vi.fn()
    }
  };
});

describe('PermissionsModule', () => {
  let module: PermissionsModule;
  let mockLogger: any;
  
  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
    
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };
    
    // Setup default mock responses
    mockDb.query.mockResolvedValue([]);
    mockDb.execute.mockResolvedValue(undefined);
    mockDb.transaction.mockImplementation(async (callback: any) => {
      return await callback();
    });
    
    module = new PermissionsModule();
    await module.initialize({ 
      logger: mockLogger,
      config: {
        defaultPermissions: {
          user: [
            { resource: 'users', actions: ['view:self', 'update:self'] }
          ],
          guest: [
            { resource: 'system', actions: ['view'] }
          ]
        }
      }
    });
  });
  
  afterEach(async () => {
    await module.stop();
  });
  
  describe('Module Lifecycle', () => {
    it('should initialize successfully', () => {
      expect(module.name).toBe('permissions');
      expect(module.version).toBe('1.0.0');
      expect(module.type).toBe('service');
      expect(mockLogger.info).toHaveBeenCalledWith('Permissions module initialized');
    });
    
    it('should start successfully', async () => {
      await module.start();
      expect(mockLogger.info).toHaveBeenCalledWith('Permissions module started');
    });
    
    it('should stop successfully', async () => {
      await module.start();
      await module.stop();
      expect(mockLogger.info).toHaveBeenCalledWith('Permissions module stopped');
    });
    
    it('should return healthy status when database is accessible', async () => {
      mockDb.query.mockResolvedValueOnce([]); // For listRoles
      
      const health = await module.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.message).toBe('Permissions module is healthy');
    });
    
    it('should return unhealthy status when database fails', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database error'));
      
      const health = await module.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.message).toContain('Permissions module health check failed');
    });
  });
  
  describe('Permission Management', () => {
    it('should check permissions with default permissions', async () => {
      // Mock checkUserPermission to return false (no direct permission)
      mockDb.query.mockResolvedValueOnce([{ count: 0 }]);
      
      // Mock getUserRoles to return 'user' role
      mockDb.query.mockResolvedValueOnce([
        { id: '1', name: 'user', is_system: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ]);
      
      const check: PermissionCheck = {
        userId: 'test-user',
        resource: 'users',
        action: 'view:self'
      };
      
      const result = await module.checkPermission(check);
      expect(result.allowed).toBe(true);
      expect(result.matchedBy).toBe('default');
    });
    
    it('should deny permission when not granted', async () => {
      // Mock checkUserPermission to return false
      mockDb.query.mockResolvedValueOnce([{ count: 0 }]);
      
      // Mock empty roles
      mockDb.query.mockResolvedValueOnce([]);
      
      const check: PermissionCheck = {
        userId: 'test-user',
        resource: 'admin',
        action: 'delete'
      };
      
      const result = await module.checkPermission(check);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No permission');
    });
    
    it('should grant permission', async () => {
      // Mock role exists check
      mockDb.query.mockResolvedValueOnce([{ count: 1 }]);
      
      // Mock permission lookup (not found)
      mockDb.query.mockResolvedValueOnce([]);
      
      // Mock permission creation and retrieval
      mockDb.query.mockResolvedValueOnce([{
        id: 1,
        resource: 'users',
        action: 'create',
        created_at: new Date().toISOString()
      }]);
      
      // Mock empty role members for cache invalidation
      mockDb.query.mockResolvedValueOnce([]);
      
      await expect(module.grantPermission({
        targetId: 'test-role',
        targetType: 'role',
        resource: 'users',
        action: 'create',
        grantedBy: 'admin'
      })).resolves.not.toThrow();
      
      expect(mockDb.execute).toHaveBeenCalled();
    });
    
    it('should list permissions', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          resource: 'users',
          action: 'view',
          scope: 'all',
          created_at: new Date().toISOString()
        }
      ]);
      
      const permissions = await module.listPermissions();
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBe(1);
      expect(permissions[0].resource).toBe('users');
    });
  });
  
  describe('Role Management', () => {
    it('should list roles', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: '1',
          name: 'admin',
          description: 'Administrator',
          is_system: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
      
      const roles = await module.listRoles();
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBe(1);
      expect(roles[0].name).toBe('admin');
    });
    
    it('should create a role', async () => {
      // Mock name check
      mockDb.query.mockResolvedValueOnce([]);
      
      const role = await module.createRole({
        name: 'test-role',
        description: 'Test role'
      });
      
      expect(role).toBeDefined();
      expect(role.name).toBe('test-role');
      expect(role.isSystem).toBe(false);
      expect(mockDb.execute).toHaveBeenCalled();
    });
    
    it('should get role by name', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: '1',
          name: 'admin',
          is_system: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
      
      const role = await module.getRole('admin');
      expect(role).toBeDefined();
      expect(role?.name).toBe('admin');
    });
    
    it('should update role', async () => {
      // Mock getRole
      mockDb.query.mockResolvedValueOnce([
        {
          id: '1',
          name: 'test-role',
          is_system: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
      
      // Mock update
      mockDb.execute.mockResolvedValueOnce(undefined);
      
      // Mock return updated role
      mockDb.query.mockResolvedValueOnce([
        {
          id: '1',
          name: 'test-role',
          description: 'Updated description',
          is_system: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
      
      const role = await module.updateRole('test-role', {
        description: 'Updated description'
      });
      
      expect(role.description).toBe('Updated description');
    });
    
    it('should prevent updating system roles', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: '1',
          name: 'admin',
          is_system: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
      
      await expect(module.updateRole('admin', {
        description: 'New description'
      })).rejects.toThrow('Cannot update system role');
    });
    
    it('should delete role', async () => {
      // Mock getRole
      mockDb.query.mockResolvedValueOnce([
        {
          id: '1',
          name: 'test-role',
          is_system: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
      
      // Mock members count
      mockDb.query.mockResolvedValueOnce([{ count: 0 }]);
      
      await expect(module.deleteRole('test-role')).resolves.not.toThrow();
      expect(mockDb.execute).toHaveBeenCalled();
    });
    
    it('should prevent deleting system roles', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: '1',
          name: 'admin',
          is_system: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
      
      await expect(module.deleteRole('admin')).rejects.toThrow('Cannot delete system role');
    });
    
    it('should prevent deleting roles with members', async () => {
      // Mock getRole
      mockDb.query.mockResolvedValueOnce([
        {
          id: '1',
          name: 'test-role',
          is_system: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
      
      // Mock members count
      mockDb.query.mockResolvedValueOnce([{ count: 5 }]);
      
      await expect(module.deleteRole('test-role')).rejects.toThrow('Cannot delete role with 5 members');
    });
  });
  
  describe('User Role Management', () => {
    it('should assign role to user', async () => {
      // Mock role not already assigned
      mockDb.query.mockResolvedValueOnce([]);
      
      await expect(module.assignRole('user-id', 'role-id')).resolves.not.toThrow();
      expect(mockDb.execute).toHaveBeenCalled();
    });
    
    it('should prevent duplicate role assignment', async () => {
      // Mock role already assigned
      mockDb.query.mockResolvedValueOnce([{ user_id: 'user-id', role_id: 'role-id' }]);
      
      await expect(module.assignRole('user-id', 'role-id')).rejects.toThrow('Role already assigned');
    });
    
    it('should unassign role from user', async () => {
      await expect(module.unassignRole('user-id', 'role-id')).resolves.not.toThrow();
      expect(mockDb.execute).toHaveBeenCalled();
    });
    
    it('should get user roles', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: '1',
          name: 'user',
          is_system: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
      
      const roles = await module.getUserRoles('user-id');
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBe(1);
      expect(roles[0].name).toBe('user');
    });
    
    it('should get role members', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 'user1',
          role_id: 'role1',
          assigned_at: new Date().toISOString()
        }
      ]);
      
      const members = await module.getRoleMembers('role1');
      expect(Array.isArray(members)).toBe(true);
      expect(members.length).toBe(1);
      expect(members[0].userId).toBe('user1');
    });
  });
  
  describe('Audit', () => {
    it('should get audit entries', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          user_id: 'admin',
          target_type: 'user',
          target_id: 'user1',
          action: 'grant',
          resource: 'users',
          permission_action: 'create',
          timestamp: new Date().toISOString()
        }
      ]);
      
      const entries = await module.getAuditEntries();
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBe(1);
      expect(entries[0].action).toBe('grant');
    });
  });
  
  describe('CLI Commands', () => {
    it('should provide CLI command', async () => {
      const command = await module.getCommand();
      expect(command).toBeDefined();
      expect(command.name()).toBe('perms');
      
      // Check subcommands
      const subcommands = command.commands.map((cmd: any) => cmd.name());
      expect(subcommands).toContain('permissions');
      expect(subcommands).toContain('roles');
    });
  });
  
  describe('Module Interface Compliance', () => {
    it('should implement required module interface methods', () => {
      expect(typeof module.initialize).toBe('function');
      expect(typeof module.start).toBe('function');
      expect(typeof module.stop).toBe('function');
      expect(typeof module.healthCheck).toBe('function');
    });
    
    it('should have required module properties', () => {
      expect(module.name).toBeDefined();
      expect(module.version).toBeDefined();
      expect(module.type).toBeDefined();
    });
  });
  
  describe('Lifecycle Hooks', () => {
    it('should handle user created event', async () => {
      // Mock getRole
      mockDb.query.mockResolvedValueOnce([
        {
          id: 'user-role-id',
          name: 'user',
          is_system: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
      
      // Mock role assignment check
      mockDb.query.mockResolvedValueOnce([]);
      
      await expect(module.onUserCreated('new-user-id')).resolves.not.toThrow();
      expect(mockDb.execute).toHaveBeenCalled();
    });
    
    it('should handle user deleted event', async () => {
      await expect(module.onUserDeleted('user-id')).resolves.not.toThrow();
      expect(mockDb.execute).toHaveBeenCalledWith(
        'DELETE FROM user_roles WHERE user_id = ?',
        ['user-id']
      );
    });
  });
});