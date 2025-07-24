/**
 * Unit tests for AuthCodeService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthCodeService } from '../../../../../../src/modules/core/auth/services/auth-code-service.js';
import { DatabaseService } from '../../../../../../src/modules/core/database/index.js';
import { logger } from '../../../../../../src/utils/logger.js';
import { randomBytes } from 'crypto';

// Mock dependencies
vi.mock('crypto');
vi.mock('../../../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('AuthCodeService', () => {
  let mockDatabaseService: any;
  let authCodeService: AuthCodeService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock database service
    mockDatabaseService = {
      execute: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([])
    };

    authCodeService = new AuthCodeService(mockDatabaseService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createAuthorizationCode', () => {
    it('should create authorization code with all data', async () => {
      const mockCode = 'test-auth-code-123';
      vi.mocked(randomBytes).mockReturnValue({
        toString: vi.fn().mockReturnValue(mockCode)
      } as any);

      const authData = {
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read write',
        userId: 'user123',
        userEmail: 'user@example.com',
        provider: 'google',
        providerTokens: { access_token: 'token123' },
        codeChallenge: 'challenge123',
        codeChallengeMethod: 'S256',
        expiresAt: new Date('2024-12-31T23:59:59Z')
      };

      const code = await authCodeService.createAuthorizationCode(authData);

      expect(code).toBe(mockCode);
      expect(randomBytes).toHaveBeenCalledWith(32);
      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_authorization_codes'),
        [
          mockCode,
          'test-client',
          'http://localhost:3000/callback',
          'read write',
          'user123',
          'user@example.com',
          'google',
          '{"access_token":"token123"}',
          'challenge123',
          'S256',
          '2024-12-31T23:59:59.000Z'
        ]
      );
      expect(logger.info).toHaveBeenCalledWith('Authorization code created', {
        code: 'test-aut...',
        clientId: 'test-client'
      });
    });

    it('should create authorization code with minimal data', async () => {
      const mockCode = 'minimal-code';
      vi.mocked(randomBytes).mockReturnValue({
        toString: vi.fn().mockReturnValue(mockCode)
      } as any);

      const authData = {
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        expiresAt: new Date('2024-12-31T23:59:59Z')
      };

      const code = await authCodeService.createAuthorizationCode(authData);

      expect(code).toBe(mockCode);
      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_authorization_codes'),
        [
          mockCode,
          'test-client',
          'http://localhost:3000/callback',
          'read',
          null, // userId
          null, // userEmail
          null, // provider
          null, // providerTokens
          null, // codeChallenge
          null, // codeChallengeMethod
          '2024-12-31T23:59:59.000Z'
        ]
      );
    });

    it('should handle database errors', async () => {
      const mockCode = 'error-code';
      vi.mocked(randomBytes).mockReturnValue({
        toString: vi.fn().mockReturnValue(mockCode)
      } as any);

      mockDatabaseService.execute.mockRejectedValue(new Error('Database error'));

      const authData = {
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        expiresAt: new Date()
      };

      await expect(authCodeService.createAuthorizationCode(authData))
        .rejects.toThrow('Database error');
    });
  });

  describe('getAuthorizationCode', () => {
    it('should retrieve valid authorization code', async () => {
      const mockRow = {
        code: 'test-code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read write',
        user_id: 'user123',
        user_email: 'user@example.com',
        provider: 'google',
        provider_tokens: '{"access_token":"token123"}',
        code_challenge: 'challenge123',
        code_challenge_method: 'S256',
        expires_at: '2024-12-31T23:59:59.000Z',
        created_at: '2024-01-01T00:00:00.000Z'
      };

      mockDatabaseService.query.mockResolvedValue([mockRow]);

      const result = await authCodeService.getAuthorizationCode('test-code');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM auth_authorization_codes'),
        ['test-code']
      );
      expect(result).toEqual({
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read write',
        userId: 'user123',
        userEmail: 'user@example.com',
        provider: 'google',
        providerTokens: { access_token: 'token123' },
        codeChallenge: 'challenge123',
        codeChallengeMethod: 'S256',
        expiresAt: new Date('2024-12-31T23:59:59.000Z')
      });
    });

    it('should return null for non-existent code', async () => {
      mockDatabaseService.query.mockResolvedValue([]);

      const result = await authCodeService.getAuthorizationCode('non-existent');

      expect(result).toBeNull();
    });

    it('should handle codes with null values', async () => {
      const mockRow = {
        code: 'test-code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
        user_id: null,
        user_email: null,
        provider: null,
        provider_tokens: null,
        code_challenge: null,
        code_challenge_method: null,
        expires_at: '2024-12-31T23:59:59.000Z',
        created_at: '2024-01-01T00:00:00.000Z'
      };

      mockDatabaseService.query.mockResolvedValue([mockRow]);

      const result = await authCodeService.getAuthorizationCode('test-code');

      expect(result).toEqual({
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        userId: undefined,
        userEmail: undefined,
        provider: undefined,
        providerTokens: undefined,
        codeChallenge: undefined,
        codeChallengeMethod: undefined,
        expiresAt: new Date('2024-12-31T23:59:59.000Z')
      });
    });

    it('should parse JSON provider tokens', async () => {
      const mockRow = {
        code: 'test-code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
        user_id: 'user123',
        user_email: 'user@example.com',
        provider: 'github',
        provider_tokens: '{"access_token":"github-token","refresh_token":"refresh-token"}',
        code_challenge: null,
        code_challenge_method: null,
        expires_at: '2024-12-31T23:59:59.000Z',
        created_at: '2024-01-01T00:00:00.000Z'
      };

      mockDatabaseService.query.mockResolvedValue([mockRow]);

      const result = await authCodeService.getAuthorizationCode('test-code');

      expect(result?.providerTokens).toEqual({
        access_token: 'github-token',
        refresh_token: 'refresh-token'
      });
    });
  });

  describe('deleteAuthorizationCode', () => {
    it('should delete authorization code', async () => {
      await authCodeService.deleteAuthorizationCode('test-code');

      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        'DELETE FROM auth_authorization_codes WHERE code = ?',
        ['test-code']
      );
    });

    it('should handle delete errors', async () => {
      mockDatabaseService.execute.mockRejectedValue(new Error('Delete failed'));

      await expect(authCodeService.deleteAuthorizationCode('test-code'))
        .rejects.toThrow('Delete failed');
    });
  });

  describe('cleanupExpiredCodes', () => {
    it('should delete expired authorization codes', async () => {
      await authCodeService.cleanupExpiredCodes();

      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM auth_authorization_codes')
      );
      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        expect.stringContaining('datetime(expires_at) < datetime(\'now\')')
      );
    });

    it('should handle cleanup errors', async () => {
      mockDatabaseService.execute.mockRejectedValue(new Error('Cleanup failed'));

      await expect(authCodeService.cleanupExpiredCodes())
        .rejects.toThrow('Cleanup failed');
    });
  });
});