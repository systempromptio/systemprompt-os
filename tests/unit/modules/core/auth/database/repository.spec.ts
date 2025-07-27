/**
 * Unit tests for AuthRepository
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthRepository } from '../../../../../../src/modules/core/auth/database/repository';
import { DatabaseService } from '../../../../../../src/modules/core/database/index';
import { UserService } from '../../../../../../src/modules/core/auth/services/user.service';
import { randomUUID } from 'node:crypto';

// Mock dependencies
vi.mock('node:crypto');
vi.mock('../../../../../../src/modules/core/auth/services/user.service');

describe('AuthRepository', () => {
  let mockDatabaseService: any;
  let mockUserService: any;
  let authRepository: AuthRepository;
  let mockUuid: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUuid = 'test-uuid-123';
    vi.mocked(randomUUID).mockReturnValue(mockUuid);

    // Mock database service
    mockDatabaseService = {
      execute: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      transaction: vi.fn()
    };

    // Mock user service
    mockUserService = {
      createOrUpdateUserFromOAuth: vi.fn()
    };
    vi.mocked(UserService).mockImplementation(() => mockUserService);

    authRepository = new AuthRepository(mockDatabaseService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create UserService instance', () => {
      expect(UserService).toHaveBeenCalledWith(mockDatabaseService);
    });
  });

  describe('upsertUserFromOAuth', () => {
    it('should create or update user and return with roles and permissions', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockRoles = [
        { id: 'role_admin', name: 'admin', description: 'Administrator', is_system: 1 }
      ];

      const mockPermissions = [
        { 
          id: 'perm_1', 
          name: 'manage_users', 
          resource: 'users', 
          action: 'manage',
          description: 'Manage users'
        }
      ];

      mockUserService.createOrUpdateUserFromOAuth.mockResolvedValue(mockUser);
      
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('auth_roles')) {
          return Promise.resolve(mockRoles);
        }
        if (sql.includes('auth_permissions')) {
          return Promise.resolve(mockPermissions);
        }
        return Promise.resolve([]);
      });

      const profile = {
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.jpg'
      };

      const result = await authRepository.upsertUserFromOAuth('google', 'google-123', profile);

      expect(mockUserService.createOrUpdateUserFromOAuth).toHaveBeenCalledWith({
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.jpg'
      });

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        lastLoginAt: expect.any(String),
        roles: [{
          id: 'role_admin',
          name: 'admin',
          description: 'Administrator',
          isSystem: true
        }],
        permissions: [{
          id: 'perm_1',
          name: 'manage_users',
          resource: 'users',
          action: 'manage',
          description: 'Manage users'
        }]
      });
    });

    it('should handle users without name and avatar', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: null,
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockUserService.createOrUpdateUserFromOAuth.mockResolvedValue(mockUser);
      mockDatabaseService.query.mockResolvedValue([]);

      const profile = { email: 'test@example.com' };

      const result = await authRepository.upsertUserFromOAuth('github', 'github-456', profile);

      expect(result.name).toBeUndefined();
      expect(result.avatarUrl).toBeUndefined();
      expect(result.roles).toEqual([]);
      expect(result.permissions).toEqual([]);
    });
  });

  describe('getUserById', () => {
    it('should return user with roles and permissions', async () => {
      const mockUserRow = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        is_active: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_login_at: '2024-01-02T00:00:00Z'
      };

      const mockRoles = [
        { id: 'role_user', name: 'user', description: 'Regular user', is_system: 1 }
      ];

      const mockPermissions = [
        { 
          id: 'perm_1', 
          name: 'read_profile', 
          resource: 'profile', 
          action: 'read',
          description: 'Read own profile'
        }
      ];

      mockDatabaseService.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM auth_users WHERE id')) {
          return Promise.resolve([mockUserRow]);
        }
        if (sql.includes('auth_roles')) {
          return Promise.resolve(mockRoles);
        }
        if (sql.includes('auth_permissions')) {
          return Promise.resolve(mockPermissions);
        }
        return Promise.resolve([]);
      });

      const result = await authRepository.getUserById('user-123');

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-02T00:00:00Z',
        roles: [{
          id: 'role_user',
          name: 'user',
          description: 'Regular user',
          isSystem: true
        }],
        permissions: [{
          id: 'perm_1',
          name: 'read_profile',
          resource: 'profile',
          action: 'read',
          description: 'Read own profile'
        }]
      });
    });

    it('should return null for non-existent user', async () => {
      mockDatabaseService.query.mockResolvedValue([]);

      const result = await authRepository.getUserById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle inactive users', async () => {
      const mockUserRow = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: null,
        is_active: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_login_at: null
      };

      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM auth_users WHERE id')) {
          return Promise.resolve([mockUserRow]);
        }
        return Promise.resolve([]);
      });

      const result = await authRepository.getUserById('user-123');

      expect(result).toBeDefined();
      expect(result?.isActive).toBe(false);
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      const mockUserIdRow = { id: 'user-123' };
      const mockUserRow = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: null,
        is_active: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_login_at: null
      };

      mockDatabaseService.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id FROM auth_users WHERE email')) {
          return Promise.resolve([mockUserIdRow]);
        }
        if (sql.includes('SELECT * FROM auth_users WHERE id')) {
          return Promise.resolve([mockUserRow]);
        }
        return Promise.resolve([]);
      });

      const result = await authRepository.getUserByEmail('test@example.com');

      expect(result).toBeDefined();
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null for non-existent email', async () => {
      mockDatabaseService.query.mockResolvedValue([]);

      const result = await authRepository.getUserByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('getUserRoles', () => {
    it('should return user roles', async () => {
      const mockRoles = [
        { id: 'role_admin', name: 'admin', description: 'Administrator', is_system: 1 },
        { id: 'role_user', name: 'user', description: 'Regular user', is_system: 1 }
      ];

      mockDatabaseService.query.mockResolvedValue(mockRoles);

      const result = await authRepository.getUserRoles('user-123');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT r.* FROM auth_roles r'),
        ['user-123']
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'role_admin',
        name: 'admin',
        description: 'Administrator',
        isSystem: true
      });
    });

    it('should return empty array for user with no roles', async () => {
      mockDatabaseService.query.mockResolvedValue([]);

      const result = await authRepository.getUserRoles('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('getUserPermissions', () => {
    it('should return unique user permissions', async () => {
      const mockPermissions = [
        { 
          id: 'perm_1', 
          name: 'manage_users', 
          resource: 'users', 
          action: 'manage',
          description: 'Manage all users'
        },
        { 
          id: 'perm_2', 
          name: 'view_reports', 
          resource: 'reports', 
          action: 'view',
          description: 'View reports'
        }
      ];

      mockDatabaseService.query.mockResolvedValue(mockPermissions);

      const result = await authRepository.getUserPermissions('user-123');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT p.* FROM auth_permissions p'),
        ['user-123']
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'perm_1',
        name: 'manage_users',
        resource: 'users',
        action: 'manage',
        description: 'Manage all users'
      });
    });

    it('should return empty array for user with no permissions', async () => {
      mockDatabaseService.query.mockResolvedValue([]);

      const result = await authRepository.getUserPermissions('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has permission', async () => {
      mockDatabaseService.query.mockResolvedValue([{ count: 1 }]);

      const result = await authRepository.hasPermission('user-123', 'users', 'manage');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count FROM auth_permissions p'),
        ['user-123', 'users', 'manage']
      );
      expect(result).toBe(true);
    });

    it('should return false when user lacks permission', async () => {
      mockDatabaseService.query.mockResolvedValue([{ count: 0 }]);

      const result = await authRepository.hasPermission('user-123', 'users', 'delete');

      expect(result).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true when user has role', async () => {
      mockDatabaseService.query.mockResolvedValue([{ count: 1 }]);

      const result = await authRepository.hasRole('user-123', 'admin');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count FROM auth_user_roles ur'),
        ['user-123', 'admin']
      );
      expect(result).toBe(true);
    });

    it('should return false when user lacks role', async () => {
      mockDatabaseService.query.mockResolvedValue([{ count: 0 }]);

      const result = await authRepository.hasRole('user-123', 'superadmin');

      expect(result).toBe(false);
    });
  });

  describe('createSession', () => {
    it('should create session with metadata', async () => {
      const expiresAt = new Date('2024-12-31T23:59:59Z');
      const metadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };

      const sessionId = await authRepository.createSession(
        'user-123',
        'hashed-token',
        expiresAt,
        metadata
      );

      expect(sessionId).toBe(mockUuid);
      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_sessions'),
        [
          mockUuid,
          'user-123',
          'hashed-token',
          '2024-12-31T23:59:59.000Z',
          '192.168.1.1',
          'Mozilla/5.0'
        ]
      );
    });

    it('should create session without metadata', async () => {
      const expiresAt = new Date('2024-12-31T23:59:59Z');

      const sessionId = await authRepository.createSession(
        'user-123',
        'hashed-token',
        expiresAt
      );

      expect(sessionId).toBe(mockUuid);
      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_sessions'),
        [
          mockUuid,
          'user-123',
          'hashed-token',
          '2024-12-31T23:59:59.000Z',
          undefined,
          undefined
        ]
      );
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      const result = await authRepository.cleanupExpiredSessions();

      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM auth_sessions WHERE expires_at < datetime('now')")
      );
      expect(result).toBe(0); // Always returns 0 for SQLite
    });
  });
});