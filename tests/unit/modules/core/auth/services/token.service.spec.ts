/**
 * @fileoverview Unit tests for TokenService
 */

import { TokenService } from '@/modules/core/auth/services/token.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { Logger } from '@/modules/types';
import type { TokenCreateInput, TokenType } from '@/modules/core/auth/types';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

// Mock dependencies
jest.mock('@/modules/core/database/services/database.service');
jest.mock('jsonwebtoken');
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn(),
}));

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockLogger: jest.Mocked<Logger>;

  const mockJWTConfig = {
    privateKey: 'mock-private-key',
    publicKey: 'mock-public-key',
    algorithm: 'RS256' as const,
    issuer: 'test-issuer',
    audience: 'test-audience',
    accessTokenTTL: 900,
    refreshTokenTTL: 2592000,
  };

  beforeEach(() => {
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

    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);

    tokenService = new TokenService(
      { jwt: mockJWTConfig },
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createToken', () => {
    it('should create an access token successfully', async () => {
      const input: TokenCreateInput = {
        userId: 'user-123',
        type: 'access',
        scope: ['read', 'write'],
        expiresIn: 3600,
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockRoles = [{ name: 'user' }, { name: 'admin' }];

      mockDb.query
        .mockResolvedValueOnce([mockUser])
        .mockResolvedValueOnce(mockRoles);

      (randomBytes as jest.Mock).mockReturnValue(Buffer.from('mock-token-id'));
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');
      mockDb.execute.mockResolvedValue(undefined);

      const result = await tokenService.createToken(input);

      expect(result).toMatchObject({
        userId: 'user-123',
        token: 'mock-jwt-token',
        type: 'access',
        scope: ['read', 'write'],
      });

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          roles: ['user', 'admin'],
          scope: ['read', 'write'],
        }),
        'mock-private-key',
        expect.objectContaining({
          algorithm: 'RS256',
          issuer: 'test-issuer',
          audience: 'test-audience',
          expiresIn: 3600,
        })
      );

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_tokens'),
        expect.any(Array)
      );
    });

    it('should handle user not found', async () => {
      const input: TokenCreateInput = {
        userId: 'non-existent',
        type: 'access',
        scope: [],
      };

      mockDb.query.mockResolvedValueOnce([]);

      await expect(tokenService.createToken(input)).rejects.toThrow('User not found');
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        jti: 'token-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockDbToken = {
        id: 'token-123',
        user_id: 'user-123',
        is_revoked: 0,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockDb.query.mockResolvedValueOnce([mockDbToken]);
      mockDb.execute.mockResolvedValue(undefined);

      const result = await tokenService.validateToken('mock-jwt-token');

      expect(result).toMatchObject({
        valid: true,
        userId: 'user-123',
      });

      expect(jwt.verify).toHaveBeenCalledWith('mock-jwt-token', 'mock-public-key', {
        algorithms: ['RS256'],
        issuer: 'test-issuer',
        audience: 'test-audience',
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth_tokens SET last_used_at = ?'),
        expect.any(Array)
      );
    });

    it('should handle invalid JWT', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await tokenService.validateToken('invalid-token');

      expect(result).toMatchObject({
        valid: false,
        reason: 'Invalid token',
      });
    });

    it('should handle revoked token', async () => {
      const mockPayload = {
        sub: 'user-123',
        jti: 'token-123',
      };

      const mockDbToken = {
        id: 'token-123',
        user_id: 'user-123',
        is_revoked: 1,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockDb.query.mockResolvedValueOnce([mockDbToken]);

      const result = await tokenService.validateToken('mock-jwt-token');

      expect(result).toMatchObject({
        valid: false,
        reason: 'Token has been revoked',
      });
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token successfully', async () => {
      const tokenId = 'token-123';

      mockDb.execute.mockResolvedValue(undefined);

      await tokenService.revokeToken(tokenId);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth_tokens SET is_revoked = ?'),
        [1, tokenId]
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Token revoked', { tokenId });
    });
  });

  describe('revokeUserTokens', () => {
    it('should revoke all user tokens', async () => {
      const userId = 'user-123';

      mockDb.execute.mockResolvedValue(undefined);

      await tokenService.revokeUserTokens(userId);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth_tokens SET is_revoked = ?'),
        [1, userId]
      );
    });

    it('should revoke user tokens by type', async () => {
      const userId = 'user-123';
      const type: TokenType = 'refresh';

      mockDb.execute.mockResolvedValue(undefined);

      await tokenService.revokeUserTokens(userId, type);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth_tokens SET is_revoked = ?'),
        [1, userId, type]
      );
    });
  });

  describe('listUserTokens', () => {
    it('should list user tokens', async () => {
      const userId = 'user-123';
      const mockTokens = [
        {
          id: 'token-1',
          user_id: userId,
          token: 'token-1-value',
          type: 'access',
          scope: JSON.stringify(['read']),
          expires_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          last_used_at: null,
          is_revoked: 0,
          metadata: null,
        },
        {
          id: 'token-2',
          user_id: userId,
          token: 'token-2-value',
          type: 'refresh',
          scope: JSON.stringify(['read', 'write']),
          expires_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
          is_revoked: 0,
          metadata: JSON.stringify({ device: 'mobile' }),
        },
      ];

      mockDb.query.mockResolvedValueOnce(mockTokens);

      const result = await tokenService.listUserTokens(userId);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'token-1',
        userId: userId,
        type: 'access',
        scope: ['read'],
        isRevoked: false,
      });
      expect(result[1]).toMatchObject({
        id: 'token-2',
        userId: userId,
        type: 'refresh',
        scope: ['read', 'write'],
        isRevoked: false,
        metadata: { device: 'mobile' },
      });
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired tokens', async () => {
      mockDb.execute.mockResolvedValue({ rowsAffected: 5 } as any);

      const result = await tokenService.cleanupExpiredTokens();

      expect(result).toBe(5);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM auth_tokens WHERE expires_at < ?'),
        expect.any(Array)
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaned up expired tokens', { count: 5 });
    });
  });
});