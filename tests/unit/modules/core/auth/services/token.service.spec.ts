/**
 * @fileoverview Unit tests for TokenService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TokenService } from '@/modules/core/auth/services/token.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LoggerService } from '@/modules/core/logger/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import type { TokenCreateInput, TokenType, AuthToken, TokenValidationResult } from '@/modules/core/auth/types';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';

// Mock dependencies
vi.mock('@/modules/core/database/services/database.service');
vi.mock('@/modules/core/logger/index');
vi.mock('jsonwebtoken');
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    randomBytes: vi.fn(),
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('mocked-hash'),
    })),
  };
});

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockDb: any;
  let mockLogger: any;


  beforeEach(() => {
    // Clear all instances before each test
    (TokenService as any).instance = undefined;
    
    mockDb = {
      query: vi.fn(),
      execute: vi.fn(),
      transaction: vi.fn(),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    vi.spyOn(DatabaseService, 'getInstance').mockReturnValue(mockDb);
    vi.spyOn(LoggerService, 'getInstance').mockReturnValue(mockLogger);
    vi.spyOn(jwt, 'sign').mockReturnValue('mock-signed-jwt' as any);
    vi.spyOn(jwt, 'verify').mockReturnValue({} as any);
    
    // Set up default randomBytes mock
    vi.mocked(randomBytes).mockReturnValue(Buffer.from('default-bytes'));

    tokenService = TokenService.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = TokenService.getInstance();
      const instance2 = TokenService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(TokenService);
    });

    it('should create new instance if none exists', () => {
      (TokenService as any).instance = undefined;
      const instance = TokenService.getInstance();
      
      expect(instance).toBeInstanceOf(TokenService);
      expect((TokenService as any).instance).toBe(instance);
    });
  });

  describe('createToken', () => {
    beforeEach(() => {
      vi.mocked(randomBytes)
        .mockReturnValueOnce(Buffer.from('token-id-123456'))
        .mockReturnValueOnce(Buffer.from('token-value-abcdef'));
    });

    it('should create token with all parameters', async () => {
      const input: TokenCreateInput = {
        userId: 'user-123',
        type: 'access',
        scope: ['read', 'write'],
        expiresIn: 3600,
        metadata: { device: 'mobile' },
      };

      mockDb.execute.mockResolvedValue(undefined);

      const result = await tokenService.createToken(input);

      expect(result).toMatchObject({
        userId: 'user-123',
        type: 'access',
        scope: ['read', 'write'],
        isRevoked: false,
        metadata: { device: 'mobile' },
      });

      expect(result.token).toContain('.');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.createdAt).toBeInstanceOf(Date);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_tokens'),
        expect.arrayContaining([
          expect.any(String),
          'user-123',
          'mocked-hash',
          'access',
          JSON.stringify(['read', 'write']),
          expect.any(String),
          JSON.stringify({ device: 'mobile' }),
        ])
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'auth',
        'Token created',
        {
          tokenId: '746f6b656e2d69642d313233343536',
          userId: 'user-123',
          type: 'access',
        }
      );
    });

    it('should create token without metadata', async () => {
      const input: TokenCreateInput = {
        userId: 'user-123',
        type: 'access',
        scope: ['read'],
      };

      mockDb.execute.mockResolvedValue(undefined);

      const result = await tokenService.createToken(input);

      expect(result.metadata).toBeUndefined();
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_tokens'),
        expect.arrayContaining([
          expect.any(String),
          'user-123',
          'mocked-hash',
          'access',
          JSON.stringify(['read']),
          expect.any(String),
          null,
        ])
      );
    });

    it('should use default TTL when expiresIn not provided', async () => {
      const input: TokenCreateInput = {
        userId: 'user-123',
        type: 'refresh',
        scope: [],
      };

      mockDb.execute.mockResolvedValue(undefined);

      const result = await tokenService.createToken(input);

      // Should use refresh token TTL (2592000 seconds = 30 days)
      const expectedExpiry = new Date(Date.now() + 2592000 * 1000);
      const actualExpiry = result.expiresAt;
      
      // Allow for some time difference due to execution time
      expect(Math.abs(actualExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });

    it('should handle different token types with correct TTL', async () => {
      const testCases = [
        { type: 'access' as TokenType, expectedTtl: 900 },
        { type: 'refresh' as TokenType, expectedTtl: 2592000 },
        { type: 'api' as TokenType, expectedTtl: 365 * 24 * 60 * 60 },
        { type: 'personal' as TokenType, expectedTtl: 90 * 24 * 60 * 60 },
        { type: 'service' as TokenType, expectedTtl: 0 },
      ];

      for (const testCase of testCases) {
        mockDb.execute.mockClear();
        
        const input: TokenCreateInput = {
          userId: 'user-123',
          type: testCase.type,
          scope: [],
        };

        const result = await tokenService.createToken(input);
        
        if (testCase.expectedTtl === 0) {
          // Service tokens expire immediately (same time as creation)
          expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(Date.now() - 1000);
        } else {
          const expectedExpiry = new Date(Date.now() + testCase.expectedTtl * 1000);
          expect(Math.abs(result.expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
        }
      }
    });

    it('should handle database insertion error', async () => {
      const input: TokenCreateInput = {
        userId: 'user-123',
        type: 'access',
        scope: [],
      };

      mockDb.execute.mockRejectedValue(new Error('Database error'));

      await expect(tokenService.createToken(input)).rejects.toThrow('Database error');
    });
  });

  describe('createJwt', () => {
    it('should create JWT with all parameters', () => {
      const params = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['user', 'admin'],
        scope: ['read', 'write'],
      };

      vi.mocked(jwt.sign).mockReturnValue('mock-jwt-token' as any);

      const result = tokenService.createJwt(params);

      expect(result).toBe('mock-jwt-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          roles: ['user', 'admin'],
          scope: ['read', 'write'],
          iat: expect.any(Number),
          exp: expect.any(Number),
        }),
        '',
        expect.objectContaining({
          algorithm: 'RS256',
          issuer: 'systemprompt-os',
          audience: 'systemprompt-os',
        })
      );
    });

    it('should create JWT without scope', () => {
      const params = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['user'],
      };

      vi.mocked(jwt.sign).mockReturnValue('mock-jwt-token' as any);

      const result = tokenService.createJwt(params);

      expect(result).toBe('mock-jwt-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: [],
        }),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle JWT signing error', () => {
      const params = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['user'],
      };

      vi.mocked(jwt.sign).mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      expect(() => tokenService.createJwt(params)).toThrow('JWT signing failed');
    });
  });

  describe('validateToken', () => {
    describe('JWT validation', () => {
      it('should validate a valid JWT token', async () => {
        const mockPayload = {
          sub: 'user-123',
          email: 'test@example.com',
          scope: ['read', 'write'],
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        vi.mocked(jwt.verify).mockReturnValue(mockPayload as any);

        const result = await tokenService.validateToken('eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature');

        expect(result).toMatchObject({
          valid: true,
          userId: 'user-123',
          scope: ['read', 'write'],
        });

        expect(jwt.verify).toHaveBeenCalledWith(
          'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature',
          '',
          expect.objectContaining({
            algorithms: ['RS256'],
            issuer: 'systemprompt-os',
            audience: 'systemprompt-os',
          })
        );
      });

      it('should handle invalid JWT', async () => {
        vi.mocked(jwt.verify).mockImplementation(() => {
          throw new Error('Invalid token');
        });

        const result = await tokenService.validateToken('invalid.jwt.token');

        expect(result).toMatchObject({
          valid: false,
          reason: 'Invalid token',
        });
      });

      it('should handle JWT verification with non-Error exception', async () => {
        vi.mocked(jwt.verify).mockImplementation(() => {
          throw 'String error';
        });

        const result = await tokenService.validateToken('invalid.jwt.token');

        expect(result).toMatchObject({
          valid: false,
          reason: 'Invalid JWT',
        });
      });
    });

    describe('Regular token validation', () => {
      it('should validate a valid regular token', async () => {
        const tokenString = 'token-id-123.token-value-456';
        const mockTokenRow = {
          id: 'token-id-123',
          userId: 'user-123',
          tokenHash: 'mocked-hash',
          type: 'access',
          scope: JSON.stringify(['read', 'write']),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          isRevoked: false,
          metadata: JSON.stringify({ device: 'mobile' }),
        };

        mockDb.query.mockResolvedValueOnce([mockTokenRow]);
        mockDb.execute.mockResolvedValue(undefined);

        const result = await tokenService.validateToken(tokenString);

        expect(result).toMatchObject({
          valid: true,
          userId: 'user-123',
          scope: ['read', 'write'],
          token: expect.objectContaining({
            id: 'token-id-123',
            userId: 'user-123',
            type: 'access',
            scope: ['read', 'write'],
            isRevoked: false,
            metadata: { device: 'mobile' },
          }),
        });

        expect(mockDb.query).toHaveBeenCalledWith(
          'SELECT * FROM auth_tokens WHERE id = ? AND token_hash = ?',
          ['token-id-123', 'mocked-hash']
        );

        expect(mockDb.execute).toHaveBeenCalledWith(
          'UPDATE auth_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['token-id-123']
        );
      });

      it('should handle invalid token format - wrong number of parts', async () => {
        const result = await tokenService.validateToken('invalid-format');

        expect(result).toMatchObject({
          valid: false,
          reason: 'Invalid token format',
        });
      });

      it('should handle invalid token format - empty parts', async () => {
        const result = await tokenService.validateToken('.');

        expect(result).toMatchObject({
          valid: false,
          reason: 'Invalid token format',
        });
      });

      it('should handle invalid token format - missing token ID', async () => {
        const result = await tokenService.validateToken('.token-value');

        expect(result).toMatchObject({
          valid: false,
          reason: 'Invalid token format',
        });
      });

      it('should handle invalid token format - missing token value', async () => {
        const result = await tokenService.validateToken('token-id.');

        expect(result).toMatchObject({
          valid: false,
          reason: 'Invalid token format',
        });
      });

      it('should handle token not found in database', async () => {
        mockDb.query.mockResolvedValueOnce([]);

        const result = await tokenService.validateToken('token-id.token-value');

        expect(result).toMatchObject({
          valid: false,
          reason: 'Token not found',
        });
      });

      it('should handle revoked token', async () => {
        const mockTokenRow = {
          id: 'token-id-123',
          userId: 'user-123',
          tokenHash: 'mocked-hash',
          type: 'access',
          scope: JSON.stringify([]),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          createdAt: new Date().toISOString(),
          isRevoked: true,
        };

        mockDb.query.mockResolvedValueOnce([mockTokenRow]);

        const result = await tokenService.validateToken('token-id.token-value');

        expect(result).toMatchObject({
          valid: false,
          reason: 'Token revoked',
        });
      });

      it('should handle expired token', async () => {
        const mockTokenRow = {
          id: 'token-id-123',
          userId: 'user-123',
          tokenHash: 'mocked-hash',
          type: 'access',
          scope: JSON.stringify([]),
          expiresAt: new Date(Date.now() - 3600000).toISOString(),
          createdAt: new Date().toISOString(),
          isRevoked: false,
        };

        mockDb.query.mockResolvedValueOnce([mockTokenRow]);

        const result = await tokenService.validateToken('token-id.token-value');

        expect(result).toMatchObject({
          valid: false,
          reason: 'Token expired',
        });
      });

      it('should handle token without metadata and lastUsedAt', async () => {
        const mockTokenRow = {
          id: 'token-id-123',
          userId: 'user-123',
          tokenHash: 'mocked-hash',
          type: 'access',
          scope: JSON.stringify(['read']),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          createdAt: new Date().toISOString(),
          isRevoked: false,
        };

        mockDb.query.mockResolvedValueOnce([mockTokenRow]);
        mockDb.execute.mockResolvedValue(undefined);

        const result = await tokenService.validateToken('token-id.token-value');

        expect(result).toMatchObject({
          valid: true,
          userId: 'user-123',
          token: expect.objectContaining({
            id: 'token-id-123',
            userId: 'user-123',
            type: 'access',
            scope: ['read'],
            isRevoked: false,
          }),
        });
        
        // Specifically check that optional fields are not present
        expect(result.token).not.toHaveProperty('lastUsedAt');
        expect(result.token).not.toHaveProperty('metadata');
      });
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token successfully', async () => {
      const tokenId = 'token-123';

      mockDb.execute.mockResolvedValue(undefined);

      await tokenService.revokeToken(tokenId);

      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE auth_tokens SET is_revoked = true WHERE id = ?',
        [tokenId]
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'auth',
        'Token revoked',
        { tokenId }
      );
    });

    it('should handle database error during revocation', async () => {
      const tokenId = 'token-123';
      const error = new Error('Database error');

      mockDb.execute.mockRejectedValue(error);

      await expect(tokenService.revokeToken(tokenId)).rejects.toThrow('Database error');
    });
  });

  describe('revokeUserTokens', () => {
    it('should revoke all user tokens', async () => {
      const userId = 'user-123';

      mockDb.execute.mockResolvedValue(undefined);

      await tokenService.revokeUserTokens(userId);

      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE auth_tokens SET is_revoked = true WHERE userId = ?',
        [userId]
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'auth',
        'User tokens revoked',
        { userId, type: undefined }
      );
    });

    it('should revoke user tokens by type', async () => {
      const userId = 'user-123';
      const type: TokenType = 'refresh';

      mockDb.execute.mockResolvedValue(undefined);

      await tokenService.revokeUserTokens(userId, type);

      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE auth_tokens SET is_revoked = true WHERE userId = ? AND type = ?',
        [userId, type]
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'auth',
        'User tokens revoked',
        { userId, type }
      );
    });

    it('should handle database error during revocation', async () => {
      const userId = 'user-123';
      const error = new Error('Database error');

      mockDb.execute.mockRejectedValue(error);

      await expect(tokenService.revokeUserTokens(userId)).rejects.toThrow('Database error');
    });
  });

  describe('listUserTokens', () => {
    it('should list user tokens with all fields', async () => {
      const userId = 'user-123';
      const mockTokens = [
        {
          id: 'token-1',
          userId: userId,
          tokenHash: 'hash-1',
          type: 'access',
          scope: JSON.stringify(['read']),
          expiresAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          isRevoked: false,
          metadata: JSON.stringify({ device: 'mobile' }),
        },
        {
          id: 'token-2',
          userId: userId,
          tokenHash: 'hash-2',
          type: 'refresh',
          scope: JSON.stringify(['read', 'write']),
          expiresAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
          isRevoked: true,
          metadata: null,
        },
      ];

      mockDb.query.mockResolvedValueOnce(mockTokens);

      const result = await tokenService.listUserTokens(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        `SELECT * FROM auth_tokens
       WHERE userId = ? AND is_revoked = false
       ORDER BY createdAt DESC`,
        [userId]
      );

      expect(result).toHaveLength(2);
      
      expect(result[0]).toMatchObject({
        id: 'token-1',
        userId: userId,
        token: 'token-1.***',
        type: 'access',
        scope: ['read'],
        isRevoked: false,
        metadata: { device: 'mobile' },
      });
      expect(result[0].lastUsedAt).toBeInstanceOf(Date);
      
      expect(result[1]).toMatchObject({
        id: 'token-2',
        userId: userId,
        token: 'token-2.***',
        type: 'refresh',
        scope: ['read', 'write'],
        isRevoked: true,
      });
      expect(result[1].lastUsedAt).toBeUndefined();
      expect(result[1]).not.toHaveProperty('metadata');
    });

    it('should return empty array when no tokens found', async () => {
      const userId = 'user-123';
      
      mockDb.query.mockResolvedValueOnce([]);

      const result = await tokenService.listUserTokens(userId);

      expect(result).toEqual([]);
    });

    it('should handle database error', async () => {
      const userId = 'user-123';
      const error = new Error('Database error');

      mockDb.query.mockRejectedValue(error);

      await expect(tokenService.listUserTokens(userId)).rejects.toThrow('Database error');
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired tokens when some exist', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: 5 }]);
      mockDb.execute.mockResolvedValue(undefined);

      const result = await tokenService.cleanupExpiredTokens();

      expect(result).toBe(5);
      
      expect(mockDb.query).toHaveBeenCalledWith(
        "SELECT COUNT(*) as count FROM auth_tokens WHERE expires_at < datetime('now')"
      );
      
      expect(mockDb.execute).toHaveBeenCalledWith(
        "DELETE FROM auth_tokens WHERE expires_at < datetime('now')"
      );
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'auth',
        'Expired tokens cleaned up',
        { count: 5 }
      );
    });

    it('should return 0 when no expired tokens exist', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: 0 }]);

      const result = await tokenService.cleanupExpiredTokens();

      expect(result).toBe(0);
      expect(mockDb.execute).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should handle empty query result', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await tokenService.cleanupExpiredTokens();

      expect(result).toBe(0);
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should handle database query error', async () => {
      const error = new Error('Database error');
      mockDb.query.mockRejectedValue(error);

      await expect(tokenService.cleanupExpiredTokens()).rejects.toThrow('Database error');
    });

    it('should handle database execute error after count query', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: 3 }]);
      const error = new Error('Delete failed');
      mockDb.execute.mockRejectedValue(error);

      await expect(tokenService.cleanupExpiredTokens()).rejects.toThrow('Delete failed');
    });
  });

  describe('private method coverage through public methods', () => {
    describe('token generation and hashing', () => {
      it('should generate unique token IDs', async () => {
        const input: TokenCreateInput = {
          userId: 'user-123',
          type: 'access',
          scope: [],
        };

        // Mock different return values for each call
        vi.mocked(randomBytes)
          .mockReturnValueOnce(Buffer.from('id1'))
          .mockReturnValueOnce(Buffer.from('value1'))
          .mockReturnValueOnce(Buffer.from('id2'))
          .mockReturnValueOnce(Buffer.from('value2'));

        mockDb.execute.mockResolvedValue(undefined);

        const token1 = await tokenService.createToken(input);
        const token2 = await tokenService.createToken(input);

        expect(token1.id).not.toBe(token2.id);
        expect(token1.token).not.toBe(token2.token);
      });

      it('should hash tokens consistently', async () => {
        const input: TokenCreateInput = {
          userId: 'user-123',
          type: 'access',
          scope: [],
        };

        mockDb.execute.mockResolvedValue(undefined);
        
        await tokenService.createToken(input);

        expect(createHash).toHaveBeenCalledWith('sha256');
      });
    });

    describe('default TTL logic', () => {
      it('should use correct default TTL for unknown token type', async () => {
        const input: TokenCreateInput = {
          userId: 'user-123',
          type: 'unknown' as TokenType,
          scope: [],
        };

        mockDb.execute.mockResolvedValue(undefined);

        const result = await tokenService.createToken(input);
        
        // Default TTL should be 24 * 60 * 60 = 86400 seconds
        const expectedExpiry = new Date(Date.now() + 86400 * 1000);
        expect(Math.abs(result.expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
      });
    });

    describe('token mapping', () => {
      it('should properly map database rows to tokens with conditional fields', async () => {
        const userId = 'user-123';
        const mockTokens = [
          {
            id: 'token-1',
            userId: userId,
            tokenHash: 'hash-1',
            type: 'access',
            scope: JSON.stringify(['read']),
            expiresAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            lastUsedAt: new Date().toISOString(),
            isRevoked: false,
            metadata: JSON.stringify({ device: 'mobile' }),
          },
          {
            id: 'token-2',
            userId: userId,
            tokenHash: 'hash-2',
            type: 'refresh',
            scope: JSON.stringify([]),
            expiresAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            lastUsedAt: null,
            isRevoked: false,
            metadata: null,
          },
        ];

        mockDb.query.mockResolvedValueOnce(mockTokens);

        const result = await tokenService.listUserTokens(userId);

        expect(result[0]).toHaveProperty('lastUsedAt');
        expect(result[0]).toHaveProperty('metadata');
        expect(result[1]).not.toHaveProperty('lastUsedAt');
        expect(result[1]).not.toHaveProperty('metadata');
      });
    });
  });
});