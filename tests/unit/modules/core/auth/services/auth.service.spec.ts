/**
 * @fileoverview Unit tests for AuthService
 */

import { AuthService } from '@/modules/core/auth/services/auth.service';
import { MFAService } from '@/modules/core/auth/services/mfa.service';
import { TokenService } from '@/modules/core/auth/services/token.service';
import { AuthAuditService } from '@/modules/core/auth/services/audit.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { Logger } from '@/modules/types';
import type { LoginInput } from '@/modules/core/auth/types';
import bcrypt from 'bcrypt';

// Mock dependencies
jest.mock('@/modules/core/database/services/database.service');
jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let mockMFAService: jest.Mocked<MFAService>;
  let mockTokenService: jest.Mocked<TokenService>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // Create mock instances
    mockMFAService = {
      verifyMFA: jest.fn(),
      generateBackupCodes: jest.fn(),
    } as any;

    mockTokenService = {
      createToken: jest.fn(),
      validateToken: jest.fn(),
      revokeUserTokens: jest.fn(),
    } as any;

    mockAuditService = {
      getFailedLoginAttempts: jest.fn(),
      recordEvent: jest.fn(),
    } as any;

    mockDb = {
      query: jest.fn(),
      execute: jest.fn(),
      transaction: jest.fn(),
    } as any;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock DatabaseService.getInstance
    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);

    // Create AuthService instance
    authService = new AuthService(
      mockMFAService,
      mockTokenService,
      mockAuditService,
      {
        session: {
          maxConcurrent: 5,
          absoluteTimeout: 86400,
          inactivityTimeout: 3600,
        },
        security: {
          maxLoginAttempts: 5,
          lockoutDuration: 900,
          passwordMinLength: 8,
        },
      },
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully authenticate user with email and password', async () => {
      const loginInput: LoginInput = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashed-password',
        mfa_enabled: false,
        is_active: 1,
      };

      mockAuditService.getFailedLoginAttempts.mockResolvedValue(0);
      mockDb.query.mockResolvedValueOnce([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockDb.query.mockResolvedValueOnce([{ name: 'user' }]); // roles
      mockDb.transaction.mockImplementation(async (fn) => fn(mockDb));
      
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        token: 'session-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
        createdAt: new Date(),
        lastActivityAt: new Date(),
        isActive: true,
      };

      mockTokenService.createToken
        .mockResolvedValueOnce({ token: 'access-token' } as any)
        .mockResolvedValueOnce({ token: 'refresh-token' } as any);

      const result = await authService.login(loginInput);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken', 'access-token');
      expect(result).toHaveProperty('refreshToken', 'refresh-token');
      expect(result.requiresMFA).toBe(false);
      expect(mockAuditService.recordEvent).toHaveBeenCalledWith({
        action: 'auth.login',
        userId: 'user-123',
        ipAddress: loginInput.ipAddress,
        userAgent: loginInput.userAgent,
        success: true,
      });
    });

    it('should handle account lockout', async () => {
      const loginInput: LoginInput = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockAuditService.getFailedLoginAttempts.mockResolvedValue(6);

      await expect(authService.login(loginInput)).rejects.toThrow('Account locked');
      expect(mockAuditService.recordEvent).toHaveBeenCalledWith({
        action: 'auth.failed',
        resource: 'test@example.com',
        ipAddress: loginInput.ipAddress,
        userAgent: loginInput.userAgent,
        success: false,
        errorMessage: expect.stringContaining('Account locked'),
      });
    });

    it('should handle MFA requirement', async () => {
      const loginInput: LoginInput = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashed-password',
        mfa_enabled: true,
        is_active: 1,
      };

      mockAuditService.getFailedLoginAttempts.mockResolvedValue(0);
      mockDb.query.mockResolvedValueOnce([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockDb.query.mockResolvedValueOnce([{ name: 'user' }]); // roles
      mockDb.transaction.mockImplementation(async (fn) => fn(mockDb));

      const result = await authService.login(loginInput);

      expect(result.requiresMFA).toBe(true);
      expect(result.session.token).toBeDefined();
    });

    it('should handle invalid credentials', async () => {
      const loginInput: LoginInput = {
        email: 'test@example.com',
        password: 'wrong-password',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
      };

      mockAuditService.getFailedLoginAttempts.mockResolvedValue(0);
      mockDb.query.mockResolvedValueOnce([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(loginInput)).rejects.toThrow('Invalid credentials');
      expect(mockAuditService.recordEvent).toHaveBeenCalledWith({
        action: 'auth.failed',
        resource: 'test@example.com',
        ipAddress: loginInput.ipAddress,
        userAgent: loginInput.userAgent,
        success: false,
        errorMessage: 'Invalid credentials',
      });
    });
  });

  describe('completeMFALogin', () => {
    it('should complete MFA login successfully', async () => {
      const mockSession = {
        id: 'session-123',
        user_id: 'user-123',
        token: 'session-token',
        metadata: JSON.stringify({ pendingMFA: true }),
        is_active: 1,
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        mfa_enabled: true,
      };

      mockDb.query
        .mockResolvedValueOnce([mockSession]) // session query
        .mockResolvedValueOnce([mockUser]) // user query
        .mockResolvedValueOnce([{ name: 'user' }]); // roles query

      mockMFAService.verifyMFA.mockResolvedValue(true);
      mockDb.execute.mockResolvedValue(undefined);
      mockTokenService.createToken
        .mockResolvedValueOnce({ token: 'access-token' } as any)
        .mockResolvedValueOnce({ token: 'refresh-token' } as any);

      const result = await authService.completeMFALogin('session-123', '123456');

      expect(result).toHaveProperty('accessToken', 'access-token');
      expect(result).toHaveProperty('refreshToken', 'refresh-token');
      expect(result.requiresMFA).toBe(false);
      expect(mockMFAService.verifyMFA).toHaveBeenCalledWith({
        userId: 'user-123',
        code: '123456',
      });
    });

    it('should handle invalid MFA code', async () => {
      const mockSession = {
        id: 'session-123',
        user_id: 'user-123',
        token: 'session-token',
        metadata: JSON.stringify({ pendingMFA: true }),
        is_active: 1,
      };

      mockDb.query.mockResolvedValueOnce([mockSession]);
      mockMFAService.verifyMFA.mockResolvedValue(false);

      await expect(authService.completeMFALogin('session-123', '000000'))
        .rejects.toThrow('Invalid MFA code');
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      const mockSession = {
        id: 'session-123',
        user_id: 'user-123',
      };

      mockDb.query.mockResolvedValueOnce([mockSession]);
      mockDb.execute.mockResolvedValue(undefined);
      mockTokenService.revokeUserTokens.mockResolvedValue(undefined);

      await authService.logout('session-123');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth_sessions'),
        ['session-123']
      );
      expect(mockTokenService.revokeUserTokens).toHaveBeenCalledWith('user-123');
      expect(mockAuditService.recordEvent).toHaveBeenCalledWith({
        action: 'auth.logout',
        userId: 'user-123',
        success: true,
      });
    });
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      const mockTokenData = {
        userId: 'user-123',
        type: 'refresh',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockTokenService.validateToken.mockResolvedValue({
        valid: true,
        token: mockTokenData,
      });
      mockDb.query
        .mockResolvedValueOnce([mockUser])
        .mockResolvedValueOnce([{ name: 'user' }]);
      mockTokenService.createToken
        .mockResolvedValueOnce({ token: 'new-access-token' } as any)
        .mockResolvedValueOnce({ token: 'new-refresh-token' } as any);

      const result = await authService.refreshAccessToken('refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should handle invalid refresh token', async () => {
      mockTokenService.validateToken.mockResolvedValue({
        valid: false,
        reason: 'Token expired',
      });

      await expect(authService.refreshAccessToken('invalid-token'))
        .rejects.toThrow('Invalid refresh token');
    });
  });
});