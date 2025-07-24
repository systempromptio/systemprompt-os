/**
 * Unit tests for UserService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserService } from '../../../../../../src/modules/core/auth/services/user-service.js';
import { DatabaseService } from '../../../../../../src/modules/core/database/index.js';
import { logger } from '../../../../../../src/utils/logger.js';
import { randomUUID } from 'node:crypto';

// Mock dependencies
vi.mock('node:crypto');
vi.mock('../../../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('UserService', () => {
  let mockDatabaseService: any;
  let userService: UserService;
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

    userService = new UserService(mockDatabaseService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('hasAdminUsers', () => {
    it('should return true when admin users exist', async () => {
      mockDatabaseService.query.mockResolvedValue([{ count: 2 }]);

      const result = await userService.hasAdminUsers();

      expect(result).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE r.name = 'admin'")
      );
    });

    it('should return false when no admin users exist', async () => {
      mockDatabaseService.query.mockResolvedValue([{ count: 0 }]);

      const result = await userService.hasAdminUsers();

      expect(result).toBe(false);
    });

    it('should handle empty query result', async () => {
      mockDatabaseService.query.mockResolvedValue([]);

      const result = await userService.hasAdminUsers();

      expect(result).toBe(false);
    });
  });

  describe('createOrUpdateUserFromOAuth', () => {
    let mockConnection: any;

    beforeEach(() => {
      mockConnection = {
        query: vi.fn(),
        execute: vi.fn()
      };

      mockDatabaseService.transaction.mockImplementation(async (callback: any) => {
        return callback(mockConnection);
      });
    });

    it('should create new user with admin role when no admins exist', async () => {
      // No admin users exist
      mockDatabaseService.query.mockResolvedValue([{ count: 0 }]);
      
      // No existing OAuth identity
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('auth_oauth_identities')) {
          return { rows: [] };
        }
        if (sql.includes('auth_users WHERE id')) {
          return { rows: [{
            id: mockUuid,
            email: 'test@example.com',
            name: 'Test User',
            avatar_url: 'https://example.com/avatar.jpg',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }] };
        }
        if (sql.includes('auth_roles')) {
          return { rows: [{ name: 'admin' }] };
        }
        return { rows: [] };
      });

      const options = {
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.jpg'
      };

      const user = await userService.createOrUpdateUserFromOAuth(options);

      expect(user).toEqual({
        id: mockUuid,
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        roles: ['admin'],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      });

      // Verify user creation
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_users'),
        [mockUuid, 'test@example.com', 'Test User', 'https://example.com/avatar.jpg']
      );

      // Verify OAuth identity creation
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_oauth_identities'),
        expect.arrayContaining(['google', 'google-123'])
      );

      // Verify admin role assignment
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_user_roles'),
        [mockUuid, 'role_admin']
      );

      expect(logger.info).toHaveBeenCalledWith('Creating/updating user', {
        email: 'test@example.com',
        hasAdmins: false
      });
    });

    it('should create new user with user role when admins exist', async () => {
      // Admin users exist
      mockDatabaseService.query.mockResolvedValue([{ count: 1 }]);
      
      // No existing OAuth identity
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('auth_oauth_identities')) {
          return { rows: [] };
        }
        if (sql.includes('auth_users WHERE id')) {
          return { rows: [{
            id: mockUuid,
            email: 'test@example.com',
            name: 'Test User',
            avatar_url: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }] };
        }
        if (sql.includes('auth_roles')) {
          return { rows: [{ name: 'user' }] };
        }
        return { rows: [] };
      });

      const options = {
        provider: 'github',
        providerId: 'github-456',
        email: 'test@example.com'
      };

      const user = await userService.createOrUpdateUserFromOAuth(options);

      expect(user.roles).toEqual(['user']);

      // Verify user role assignment
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_user_roles'),
        [mockUuid, 'role_user']
      );

      expect(logger.info).toHaveBeenCalledWith('Created new user with role', {
        userId: mockUuid,
        email: 'test@example.com',
        role: 'user'
      });
    });

    it('should update existing user', async () => {
      const existingUserId = 'existing-user-123';
      
      // Admin check
      mockDatabaseService.query.mockResolvedValue([{ count: 1 }]);
      
      // Existing OAuth identity
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('auth_oauth_identities')) {
          return { rows: [{ user_id: existingUserId }] };
        }
        if (sql.includes('auth_users WHERE id')) {
          return { rows: [{
            id: existingUserId,
            email: 'test@example.com',
            name: 'Updated Name',
            avatar_url: 'https://example.com/new-avatar.jpg',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z'
          }] };
        }
        if (sql.includes('auth_roles')) {
          return { rows: [{ name: 'user' }] };
        }
        return { rows: [] };
      });

      const options = {
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com',
        name: 'Updated Name',
        avatar: 'https://example.com/new-avatar.jpg'
      };

      const user = await userService.createOrUpdateUserFromOAuth(options);

      expect(user.id).toBe(existingUserId);
      expect(user.name).toBe('Updated Name');

      // Verify user update
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth_users'),
        ['Updated Name', 'https://example.com/new-avatar.jpg', existingUserId]
      );

      // Should not create new OAuth identity
      expect(mockConnection.execute).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_oauth_identities'),
        expect.any(Array)
      );

      expect(logger.info).toHaveBeenCalledWith('Updated existing user', {
        userId: existingUserId,
        email: 'test@example.com'
      });
    });

    it('should handle transaction errors', async () => {
      mockDatabaseService.query.mockResolvedValue([{ count: 0 }]);
      mockDatabaseService.transaction.mockRejectedValue(new Error('Transaction failed'));

      const options = {
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com'
      };

      await expect(userService.createOrUpdateUserFromOAuth(options))
        .rejects.toThrow('Transaction failed');
    });

    it('should handle user creation failure', async () => {
      mockDatabaseService.query.mockResolvedValue([{ count: 0 }]);
      
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('auth_oauth_identities')) {
          return { rows: [] };
        }
        // Return no user when fetching after creation
        if (sql.includes('auth_users WHERE id')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      const options = {
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com'
      };

      await expect(userService.createOrUpdateUserFromOAuth(options))
        .rejects.toThrow('User creation/update failed');
    });
  });

  describe('getUserById', () => {
    it('should return user with roles', async () => {
      const userId = 'user-123';
      
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('auth_users WHERE id')) {
          return [{
            id: userId,
            email: 'test@example.com',
            name: 'Test User',
            avatar_url: 'https://example.com/avatar.jpg',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }];
        }
        if (sql.includes('auth_roles')) {
          return [{ name: 'admin' }, { name: 'user' }];
        }
        return [];
      });

      const user = await userService.getUserById(userId);

      expect(user).toEqual({
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        roles: ['admin', 'user'],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      });
    });

    it('should return null for non-existent user', async () => {
      mockDatabaseService.query.mockResolvedValue([]);

      const user = await userService.getUserById('non-existent');

      expect(user).toBeNull();
    });

    it('should handle user with no roles', async () => {
      const userId = 'user-123';
      
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('auth_users WHERE id')) {
          return [{
            id: userId,
            email: 'test@example.com',
            name: null,
            avatar_url: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }];
        }
        if (sql.includes('auth_roles')) {
          return [];
        }
        return [];
      });

      const user = await userService.getUserById(userId);

      expect(user).toBeDefined();
      expect(user?.roles).toEqual([]);
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      
      mockDatabaseService.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('auth_users WHERE email')) {
          return [{
            id: userId,
            email: email,
            name: 'Test User',
            avatar_url: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }];
        }
        if (sql.includes('auth_users WHERE id')) {
          return [{
            id: userId,
            email: email,
            name: 'Test User',
            avatar_url: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }];
        }
        if (sql.includes('auth_roles')) {
          return [{ name: 'user' }];
        }
        return [];
      });

      const user = await userService.getUserByEmail(email);

      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
      expect(user?.roles).toEqual(['user']);
    });

    it('should return null for non-existent email', async () => {
      mockDatabaseService.query.mockResolvedValue([]);

      const user = await userService.getUserByEmail('nonexistent@example.com');

      expect(user).toBeNull();
    });
  });

  describe('getUserByIdWithConnection', () => {
    it('should use provided connection for queries', async () => {
      const mockConnection = {
        query: vi.fn(),
        execute: vi.fn()
      };

      const userId = 'user-123';
      
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('auth_users WHERE id')) {
          return {
            rows: [{
              id: userId,
              email: 'test@example.com',
              name: 'Test User',
              avatar_url: null,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            }]
          };
        }
        if (sql.includes('auth_roles')) {
          return { rows: [{ name: 'admin' }] };
        }
        return { rows: [] };
      });

      // Test private method through transaction in createOrUpdateUserFromOAuth
      mockDatabaseService.query.mockResolvedValue([{ count: 0 }]);
      mockDatabaseService.transaction.mockImplementation(async (callback: any) => {
        return callback(mockConnection);
      });

      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes('auth_oauth_identities')) {
          return { rows: [] };
        }
        if (sql.includes('auth_users WHERE id')) {
          return {
            rows: [{
              id: mockUuid,
              email: 'test@example.com',
              name: 'Test User',
              avatar_url: null,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            }]
          };
        }
        if (sql.includes('auth_roles')) {
          return { rows: [{ name: 'admin' }] };
        }
        return { rows: [] };
      });

      const options = {
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com',
        name: 'Test User'
      };

      await userService.createOrUpdateUserFromOAuth(options);

      // Verify connection was used for user and role queries
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('auth_users WHERE id'),
        [mockUuid]
      );
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('auth_roles'),
        [mockUuid]
      );
    });
  });
});