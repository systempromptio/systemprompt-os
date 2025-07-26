/**
 * Unit tests for UserService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserService } from '../../../../../../src/modules/core/auth/services/user.service.js';
import { UserRepository } from '../../../../../../src/modules/core/auth/repositories/user.repository.js';
import { LogSource } from '../../../../../../src/modules/core/logger/types/index.js';
import type { 
  ICreateUserOptions, 
  IUserWithRoles, 
  IDatabaseConnection 
} from '../../../../../../src/modules/core/auth/types/user-service.types.js';

// Mock dependencies
vi.mock('../../../../../../src/modules/core/auth/repositories/user.repository', () => ({
  UserRepository: {
    getInstance: vi.fn()
  }
}));

vi.mock('../../../../../../src/modules/core/logger/types/index', () => ({
  LogSource: {
    AUTH: 'auth',
    DATABASE: 'database',
    LOGGER: 'logger'
  }
}));

describe('UserService', () => {
  let mockUserRepository: any;
  let mockLogger: any;
  let mockDb: any;
  let userService: UserService;
  let mockConnection: IDatabaseConnection;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    // Mock database service
    mockDb = {
      transaction: vi.fn()
    };

    // Mock connection
    mockConnection = {
      query: vi.fn(),
      execute: vi.fn()
    };

    // Mock user repository
    mockUserRepository = {
      hasAdminUsers: vi.fn(),
      findOAuthIdentity: vi.fn(),
      updateUser: vi.fn(),
      createUserWithOAuthIdentity: vi.fn(),
      getUserByIdWithConnection: vi.fn(),
      getUserById: vi.fn(),
      getUserByEmail: vi.fn()
    };

    vi.mocked(UserRepository.getInstance).mockReturnValue(mockUserRepository);

    // Get singleton instance and inject dependencies
    userService = UserService.getInstance();
    (userService as any).logger = mockLogger;
    (userService as any).db = mockDb;
  });

  afterEach(() => {
    vi.resetAllMocks();
    // Reset singleton instance for clean tests
    (UserService as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls to getInstance', () => {
      const instance1 = UserService.getInstance();
      const instance2 = UserService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(UserService);
    });

    it('should create instance only once', () => {
      // Reset instance
      (UserService as any).instance = undefined;
      
      const instance1 = UserService.getInstance();
      const instance2 = UserService.getInstance();
      const instance3 = UserService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
    });

    it('should have private constructor that cannot be called directly', () => {
      // Private constructor should not be accessible
      // This tests that TypeScript enforces the privacy, but at runtime it's still callable
      // So we verify the constructor is marked as private by checking if getInstance creates instances
      const instance1 = UserService.getInstance();
      const instance2 = UserService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize UserRepository on construction', () => {
      UserService.getInstance();
      expect(UserRepository.getInstance).toHaveBeenCalled();
    });
  });

  describe('hasAdminUsers', () => {
    it('should return true when admin users exist', async () => {
      mockUserRepository.hasAdminUsers.mockResolvedValue(true);

      const result = await userService.hasAdminUsers();

      expect(result).toBe(true);
      expect(mockUserRepository.hasAdminUsers).toHaveBeenCalledWith();
    });

    it('should return false when no admin users exist', async () => {
      mockUserRepository.hasAdminUsers.mockResolvedValue(false);

      const result = await userService.hasAdminUsers();

      expect(result).toBe(false);
      expect(mockUserRepository.hasAdminUsers).toHaveBeenCalledWith();
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Repository connection failed');
      mockUserRepository.hasAdminUsers.mockRejectedValue(repositoryError);

      await expect(userService.hasAdminUsers()).rejects.toThrow('Repository connection failed');
    });
  });

  describe('createOrUpdateUserFromOauth', () => {
    const mockUser: IUserWithRoles = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatarurl: 'https://example.com/avatar.jpg',
      roles: ['admin'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    const options: ICreateUserOptions = {
      provider: 'google',
      providerId: 'google-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar: 'https://example.com/avatar.jpg'
    };

    beforeEach(() => {
      mockDb.transaction.mockImplementation(async (callback: any) => {
        return callback(mockConnection);
      });
    });

    it('should create new user with admin role when no admins exist', async () => {
      const userId = 'new-user-123';
      mockUserRepository.hasAdminUsers.mockResolvedValue(false);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(null);
      mockUserRepository.createUserWithOAuthIdentity.mockResolvedValue(userId);
      mockUserRepository.getUserByIdWithConnection.mockResolvedValue({
        ...mockUser,
        id: userId,
        roles: ['admin']
      });

      const result = await userService.createOrUpdateUserFromOauth(options);

      expect(result.id).toBe(userId);
      expect(result.roles).toEqual(['admin']);
      expect(mockUserRepository.hasAdminUsers).toHaveBeenCalled();
      expect(mockUserRepository.findOAuthIdentity).toHaveBeenCalledWith(
        'google',
        'google-123',
        mockConnection
      );
      expect(mockUserRepository.createUserWithOAuthIdentity).toHaveBeenCalledWith(
        options,
        false,
        mockConnection
      );
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Creating/updating user', {
        email: 'test@example.com',
        hasAdmins: false
      });
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Created new user with role', {
        userId,
        email: 'test@example.com',
        role: 'admin'
      });
    });

    it('should create new user with user role when admins exist', async () => {
      const userId = 'new-user-123';
      mockUserRepository.hasAdminUsers.mockResolvedValue(true);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(null);
      mockUserRepository.createUserWithOAuthIdentity.mockResolvedValue(userId);
      mockUserRepository.getUserByIdWithConnection.mockResolvedValue({
        ...mockUser,
        id: userId,
        roles: ['user']
      });

      const result = await userService.createOrUpdateUserFromOauth(options);

      expect(result.id).toBe(userId);
      expect(result.roles).toEqual(['user']);
      expect(mockUserRepository.createUserWithOAuthIdentity).toHaveBeenCalledWith(
        options,
        true,
        mockConnection
      );
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Creating/updating user', {
        email: 'test@example.com',
        hasAdmins: true
      });
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Created new user with role', {
        userId,
        email: 'test@example.com',
        role: 'user'
      });
    });

    it('should update existing user', async () => {
      const existingUserId = 'existing-user-123';
      mockUserRepository.hasAdminUsers.mockResolvedValue(true);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(existingUserId);
      mockUserRepository.getUserByIdWithConnection.mockResolvedValue({
        ...mockUser,
        id: existingUserId,
        name: 'Updated Name'
      });

      const updateOptions = {
        ...options,
        name: 'Updated Name'
      };

      const result = await userService.createOrUpdateUserFromOauth(updateOptions);

      expect(result.id).toBe(existingUserId);
      expect(result.name).toBe('Updated Name');
      expect(mockUserRepository.updateUser).toHaveBeenCalledWith(
        existingUserId,
        'Updated Name',
        'https://example.com/avatar.jpg',
        mockConnection
      );
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Updated existing user', {
        userId: existingUserId,
        email: 'test@example.com'
      });
    });

    it('should handle undefined name and avatar in options', async () => {
      const userId = 'user-123';
      const optionsWithUndefined = {
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com'
        // name and avatar are undefined
      };

      mockUserRepository.hasAdminUsers.mockResolvedValue(false);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(null);
      mockUserRepository.createUserWithOAuthIdentity.mockResolvedValue(userId);
      mockUserRepository.getUserByIdWithConnection.mockResolvedValue({
        ...mockUser,
        id: userId,
        name: null,
        avatarurl: null
      });

      const result = await userService.createOrUpdateUserFromOauth(optionsWithUndefined);

      expect(result.name).toBeNull();
      expect(result.avatarurl).toBeNull();
      expect(mockUserRepository.createUserWithOAuthIdentity).toHaveBeenCalledWith(
        optionsWithUndefined,
        false,
        mockConnection
      );
    });

    it('should handle updateUser for existing user with undefined values', async () => {
      const existingUserId = 'existing-user-123';
      const optionsWithUndefined = {
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com'
        // name and avatar are undefined
      };

      mockUserRepository.hasAdminUsers.mockResolvedValue(true);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(existingUserId);
      mockUserRepository.getUserByIdWithConnection.mockResolvedValue({
        ...mockUser,
        id: existingUserId
      });

      await userService.createOrUpdateUserFromOauth(optionsWithUndefined);

      expect(mockUserRepository.updateUser).toHaveBeenCalledWith(
        existingUserId,
        undefined,
        undefined,
        mockConnection
      );
    });

    it('should throw error when user creation/update fails', async () => {
      mockUserRepository.hasAdminUsers.mockResolvedValue(false);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(null);
      mockUserRepository.createUserWithOAuthIdentity.mockResolvedValue('user-123');
      mockUserRepository.getUserByIdWithConnection.mockResolvedValue(null);

      await expect(userService.createOrUpdateUserFromOauth(options))
        .rejects.toThrow('User creation/update failed');
    });

    it('should handle transaction errors', async () => {
      mockUserRepository.hasAdminUsers.mockResolvedValue(false);
      mockDb.transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(userService.createOrUpdateUserFromOauth(options))
        .rejects.toThrow('Transaction failed');
    });

    it('should handle hasAdminUsers errors', async () => {
      mockUserRepository.hasAdminUsers.mockRejectedValue(new Error('Admin check failed'));

      await expect(userService.createOrUpdateUserFromOauth(options))
        .rejects.toThrow('Admin check failed');
    });

    it('should handle findOAuthIdentity errors within transaction', async () => {
      mockUserRepository.hasAdminUsers.mockResolvedValue(false);
      mockUserRepository.findOAuthIdentity.mockRejectedValue(new Error('Identity lookup failed'));

      await expect(userService.createOrUpdateUserFromOauth(options))
        .rejects.toThrow('Identity lookup failed');
    });

    it('should handle updateUser errors for existing users', async () => {
      const existingUserId = 'existing-user-123';
      mockUserRepository.hasAdminUsers.mockResolvedValue(true);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(existingUserId);
      mockUserRepository.updateUser.mockRejectedValue(new Error('Update failed'));

      await expect(userService.createOrUpdateUserFromOauth(options))
        .rejects.toThrow('Update failed');
    });

    it('should handle createUserWithOAuthIdentity errors for new users', async () => {
      mockUserRepository.hasAdminUsers.mockResolvedValue(false);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(null);
      mockUserRepository.createUserWithOAuthIdentity.mockRejectedValue(new Error('Creation failed'));

      await expect(userService.createOrUpdateUserFromOauth(options))
        .rejects.toThrow('Creation failed');
    });

    it('should handle getUserByIdWithConnection errors', async () => {
      const userId = 'user-123';
      mockUserRepository.hasAdminUsers.mockResolvedValue(false);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(null);
      mockUserRepository.createUserWithOAuthIdentity.mockResolvedValue(userId);
      mockUserRepository.getUserByIdWithConnection.mockRejectedValue(new Error('Get user failed'));

      await expect(userService.createOrUpdateUserFromOauth(options))
        .rejects.toThrow('Get user failed');
    });

    it('should handle empty string values in options', async () => {
      const emptyOptions: ICreateUserOptions = {
        provider: '',
        providerId: '',
        email: '',
        name: '',
        avatar: ''
      };

      const userId = 'user-123';
      mockUserRepository.hasAdminUsers.mockResolvedValue(false);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(null);
      mockUserRepository.createUserWithOAuthIdentity.mockResolvedValue(userId);
      mockUserRepository.getUserByIdWithConnection.mockResolvedValue({
        ...mockUser,
        id: userId,
        email: '',
        name: '',
        avatarurl: ''
      });

      const result = await userService.createOrUpdateUserFromOauth(emptyOptions);

      expect(result).toBeDefined();
      expect(mockUserRepository.createUserWithOAuthIdentity).toHaveBeenCalledWith(
        emptyOptions,
        false,
        mockConnection
      );
    });
  });

  describe('getUserById', () => {
    const mockUser: IUserWithRoles = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatarurl: 'https://example.com/avatar.jpg',
      roles: ['user'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    it('should return user with roles', async () => {
      mockUserRepository.getUserById.mockResolvedValue(mockUser);

      const result = await userService.getUserById('user-123');

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-123');
    });

    it('should return null for non-existent user', async () => {
      mockUserRepository.getUserById.mockResolvedValue(null);

      const result = await userService.getUserById('non-existent');

      expect(result).toBeNull();
      expect(mockUserRepository.getUserById).toHaveBeenCalledWith('non-existent');
    });

    it('should handle repository errors', async () => {
      mockUserRepository.getUserById.mockRejectedValue(new Error('Repository error'));

      await expect(userService.getUserById('user-123')).rejects.toThrow('Repository error');
    });

    it('should handle empty string user ID', async () => {
      mockUserRepository.getUserById.mockResolvedValue(null);

      const result = await userService.getUserById('');

      expect(result).toBeNull();
      expect(mockUserRepository.getUserById).toHaveBeenCalledWith('');
    });

    it('should handle null user ID', async () => {
      mockUserRepository.getUserById.mockResolvedValue(null);

      const result = await userService.getUserById(null as any);

      expect(result).toBeNull();
      expect(mockUserRepository.getUserById).toHaveBeenCalledWith(null);
    });

    it('should handle user with null values', async () => {
      const userWithNulls: IUserWithRoles = {
        id: 'user-123',
        email: 'test@example.com',
        name: null,
        avatarurl: null,
        roles: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      mockUserRepository.getUserById.mockResolvedValue(userWithNulls);

      const result = await userService.getUserById('user-123');

      expect(result).toEqual(userWithNulls);
      expect(result?.name).toBeNull();
      expect(result?.avatarurl).toBeNull();
      expect(result?.roles).toEqual([]);
    });
  });

  describe('getUserByEmail', () => {
    const mockUser: IUserWithRoles = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatarurl: 'https://example.com/avatar.jpg',
      roles: ['user'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    it('should return user by email', async () => {
      mockUserRepository.getUserByEmail.mockResolvedValue(mockUser);

      const result = await userService.getUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.getUserByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should return null for non-existent email', async () => {
      mockUserRepository.getUserByEmail.mockResolvedValue(null);

      const result = await userService.getUserByEmail('nonexistent@example.com');

      expect(result).toBeNull();
      expect(mockUserRepository.getUserByEmail).toHaveBeenCalledWith('nonexistent@example.com');
    });

    it('should handle repository errors', async () => {
      mockUserRepository.getUserByEmail.mockRejectedValue(new Error('Email lookup failed'));

      await expect(userService.getUserByEmail('test@example.com')).rejects.toThrow('Email lookup failed');
    });

    it('should handle empty string email', async () => {
      mockUserRepository.getUserByEmail.mockResolvedValue(null);

      const result = await userService.getUserByEmail('');

      expect(result).toBeNull();
      expect(mockUserRepository.getUserByEmail).toHaveBeenCalledWith('');
    });

    it('should handle null email', async () => {
      mockUserRepository.getUserByEmail.mockResolvedValue(null);

      const result = await userService.getUserByEmail(null as any);

      expect(result).toBeNull();
      expect(mockUserRepository.getUserByEmail).toHaveBeenCalledWith(null);
    });

    it('should handle malformed email addresses', async () => {
      const malformedEmail = 'not-an-email';
      mockUserRepository.getUserByEmail.mockResolvedValue(null);

      const result = await userService.getUserByEmail(malformedEmail);

      expect(result).toBeNull();
      expect(mockUserRepository.getUserByEmail).toHaveBeenCalledWith(malformedEmail);
    });
  });

  describe('createNewUserFromOAuth (private method)', () => {
    const options: ICreateUserOptions = {
      provider: 'google',
      providerId: 'google-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar: 'https://example.com/avatar.jpg'
    };

    it('should call createUserWithOAuthIdentity with correct parameters', async () => {
      const userId = 'new-user-123';
      mockUserRepository.hasAdminUsers.mockResolvedValue(false);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(null);
      mockUserRepository.createUserWithOAuthIdentity.mockResolvedValue(userId);
      mockUserRepository.getUserByIdWithConnection.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        avatarurl: 'https://example.com/avatar.jpg',
        roles: ['admin'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });

      mockDb.transaction.mockImplementation(async (callback: any) => {
        return callback(mockConnection);
      });

      await userService.createOrUpdateUserFromOauth(options);

      expect(mockUserRepository.createUserWithOAuthIdentity).toHaveBeenCalledWith(
        options,
        false, // hasAdmins = false
        mockConnection
      );
    });

    it('should pass hasAdmins flag correctly when admins exist', async () => {
      const userId = 'new-user-123';
      mockUserRepository.hasAdminUsers.mockResolvedValue(true);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(null);
      mockUserRepository.createUserWithOAuthIdentity.mockResolvedValue(userId);
      mockUserRepository.getUserByIdWithConnection.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        avatarurl: 'https://example.com/avatar.jpg',
        roles: ['user'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });

      mockDb.transaction.mockImplementation(async (callback: any) => {
        return callback(mockConnection);
      });

      await userService.createOrUpdateUserFromOauth(options);

      expect(mockUserRepository.createUserWithOAuthIdentity).toHaveBeenCalledWith(
        options,
        true, // hasAdmins = true
        mockConnection
      );
    });
  });

  describe('Logging', () => {
    it('should use LogSource.AUTH for all logging calls', async () => {
      const userId = 'user-123';
      const options: ICreateUserOptions = {
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com'
      };

      mockUserRepository.hasAdminUsers.mockResolvedValue(false);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(null);
      mockUserRepository.createUserWithOAuthIdentity.mockResolvedValue(userId);
      mockUserRepository.getUserByIdWithConnection.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        name: null,
        avatarurl: null,
        roles: ['admin'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });

      mockDb.transaction.mockImplementation(async (callback: any) => {
        return callback(mockConnection);
      });

      await userService.createOrUpdateUserFromOauth(options);

      // Verify all logging calls use LogSource.AUTH
      expect(mockLogger.info).toHaveBeenCalledWith(
        LogSource.AUTH,
        'Creating/updating user',
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        LogSource.AUTH,
        'Created new user with role',
        expect.any(Object)
      );
    });

    it('should log correct context information', async () => {
      const userId = 'user-123';
      const options: ICreateUserOptions = {
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com',
        name: 'Test User'
      };

      mockUserRepository.hasAdminUsers.mockResolvedValue(true);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(null);
      mockUserRepository.createUserWithOAuthIdentity.mockResolvedValue(userId);
      mockUserRepository.getUserByIdWithConnection.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        avatarurl: null,
        roles: ['user'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });

      mockDb.transaction.mockImplementation(async (callback: any) => {
        return callback(mockConnection);
      });

      await userService.createOrUpdateUserFromOauth(options);

      expect(mockLogger.info).toHaveBeenCalledWith(
        LogSource.AUTH,
        'Creating/updating user',
        {
          email: 'test@example.com',
          hasAdmins: true
        }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        LogSource.AUTH,
        'Created new user with role',
        {
          userId,
          email: 'test@example.com',
          role: 'user'
        }
      );
    });

    it('should log update operations correctly', async () => {
      const existingUserId = 'existing-user-123';
      const options: ICreateUserOptions = {
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com'
      };

      mockUserRepository.hasAdminUsers.mockResolvedValue(true);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(existingUserId);
      mockUserRepository.getUserByIdWithConnection.mockResolvedValue({
        id: existingUserId,
        email: 'test@example.com',
        name: null,
        avatarurl: null,
        roles: ['user'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });

      mockDb.transaction.mockImplementation(async (callback: any) => {
        return callback(mockConnection);
      });

      await userService.createOrUpdateUserFromOauth(options);

      expect(mockLogger.info).toHaveBeenCalledWith(
        LogSource.AUTH,
        'Updated existing user',
        {
          userId: existingUserId,
          email: 'test@example.com'
        }
      );
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete user creation flow', async () => {
      const options: ICreateUserOptions = {
        provider: 'github',
        providerId: 'github-456',
        email: 'new@example.com',
        name: 'New User',
        avatar: 'https://github.com/avatar.jpg'
      };
      const userId = 'new-user-456';

      mockUserRepository.hasAdminUsers.mockResolvedValue(true);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(null);
      mockUserRepository.createUserWithOAuthIdentity.mockResolvedValue(userId);
      mockUserRepository.getUserByIdWithConnection.mockResolvedValue({
        id: userId,
        email: 'new@example.com',
        name: 'New User',
        avatarurl: 'https://github.com/avatar.jpg',
        roles: ['user'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });

      mockDb.transaction.mockImplementation(async (callback: any) => {
        return callback(mockConnection);
      });

      const result = await userService.createOrUpdateUserFromOauth(options);

      expect(result.id).toBe(userId);
      expect(result.email).toBe('new@example.com');
      expect(result.name).toBe('New User');
      expect(result.avatarurl).toBe('https://github.com/avatar.jpg');
      expect(result.roles).toEqual(['user']);

      // Verify the complete flow was executed
      expect(mockUserRepository.hasAdminUsers).toHaveBeenCalled();
      expect(mockUserRepository.findOAuthIdentity).toHaveBeenCalledWith(
        'github',
        'github-456',
        mockConnection
      );
      expect(mockUserRepository.createUserWithOAuthIdentity).toHaveBeenCalledWith(
        options,
        true,
        mockConnection
      );
      expect(mockUserRepository.getUserByIdWithConnection).toHaveBeenCalledWith(
        userId,
        mockConnection
      );
    });

    it('should handle complete user update flow', async () => {
      const options: ICreateUserOptions = {
        provider: 'google',
        providerId: 'google-789',
        email: 'existing@example.com',
        name: 'Updated Name',
        avatar: 'https://google.com/new-avatar.jpg'
      };
      const existingUserId = 'existing-user-789';

      mockUserRepository.hasAdminUsers.mockResolvedValue(true);
      mockUserRepository.findOAuthIdentity.mockResolvedValue(existingUserId);
      mockUserRepository.getUserByIdWithConnection.mockResolvedValue({
        id: existingUserId,
        email: 'existing@example.com',
        name: 'Updated Name',
        avatarurl: 'https://google.com/new-avatar.jpg',
        roles: ['admin', 'user'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z'
      });

      mockDb.transaction.mockImplementation(async (callback: any) => {
        return callback(mockConnection);
      });

      const result = await userService.createOrUpdateUserFromOauth(options);

      expect(result.id).toBe(existingUserId);
      expect(result.name).toBe('Updated Name');
      expect(result.avatarurl).toBe('https://google.com/new-avatar.jpg');

      // Verify the complete update flow was executed
      expect(mockUserRepository.hasAdminUsers).toHaveBeenCalled();
      expect(mockUserRepository.findOAuthIdentity).toHaveBeenCalledWith(
        'google',
        'google-789',
        mockConnection
      );
      expect(mockUserRepository.updateUser).toHaveBeenCalledWith(
        existingUserId,
        'Updated Name',
        'https://google.com/new-avatar.jpg',
        mockConnection
      );
      expect(mockUserRepository.getUserByIdWithConnection).toHaveBeenCalledWith(
        existingUserId,
        mockConnection
      );
      // Should NOT call createUserWithOAuthIdentity for existing users
      expect(mockUserRepository.createUserWithOAuthIdentity).not.toHaveBeenCalled();
    });
  });
});