/**
 * Unit tests for AuthCodeService
 * Comprehensive test suite covering all methods, branches, and error scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthCodeService } from '../../../../../../src/modules/core/auth/services/auth-code.service.js';
import { AuthCodeRepository } from '../../../../../../src/modules/core/auth/repositories/auth-code.repository.js';
import type { IAuthorizationCodeData } from '../../../../../../src/modules/core/auth/types/auth-code.types.js';
import { randomBytes } from 'crypto';

// Mock dependencies
vi.mock('crypto');
vi.mock('../../../../../../src/modules/core/auth/repositories/auth-code.repository.js');

// Mock the singleton reset for testing
const resetSingleton = () => {
  // Access the private static instance property to reset it
  (AuthCodeService as any).instance = undefined;
};

describe('AuthCodeService', () => {
  let mockRepository: any;
  let authCodeService: AuthCodeService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSingleton();

    // Mock repository methods
    mockRepository = {
      storeAuthorizationCode: vi.fn().mockResolvedValue(undefined),
      getAuthorizationCode: vi.fn().mockResolvedValue(null),
      deleteAuthorizationCode: vi.fn().mockResolvedValue(undefined),
      cleanupExpiredCodes: vi.fn().mockResolvedValue(undefined)
    };

    // Mock AuthCodeRepository.getInstance()
    vi.mocked(AuthCodeRepository.getInstance).mockReturnValue(mockRepository);

    authCodeService = AuthCodeService.getInstance();
  });

  afterEach(() => {
    vi.resetAllMocks();
    resetSingleton();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AuthCodeService.getInstance();
      const instance2 = AuthCodeService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(AuthCodeService);
    });

    it('should create new instance only once', () => {
      vi.clearAllMocks(); // Clear mocks from beforeEach
      resetSingleton();
      
      const instance1 = AuthCodeService.getInstance();
      const instance2 = AuthCodeService.getInstance();
      const instance3 = AuthCodeService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(AuthCodeRepository.getInstance).toHaveBeenCalledTimes(1); // Called once during first construction
    });

    it('should initialize repository on first call', () => {
      vi.clearAllMocks(); // Clear mocks from beforeEach
      resetSingleton();
      
      AuthCodeService.getInstance();
      
      expect(AuthCodeRepository.getInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe('createAuthorizationCode', () => {
    it('should generate base64url code and store authorization data', async () => {
      const mockCode = 'test-auth-code-base64url-string';
      vi.mocked(randomBytes).mockReturnValue({
        toString: vi.fn().mockReturnValue(mockCode)
      } as any);

      const authData: IAuthorizationCodeData = {
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read write',
        userId: 'user123',
        userEmail: 'user@example.com',
        provider: 'google',
        providerTokens: { access_token: 'token123', refresh_token: 'refresh123' },
        codeChallenge: 'challenge123',
        codeChallengeMethod: 'S256',
        expiresAt: new Date('2024-12-31T23:59:59Z')
      };

      const result = await authCodeService.createAuthorizationCode(authData);

      expect(result).toBe(mockCode);
      expect(randomBytes).toHaveBeenCalledWith(32);
      expect(vi.mocked(randomBytes).mock.results[0].value.toString).toHaveBeenCalledWith('base64url');
      expect(mockRepository.storeAuthorizationCode).toHaveBeenCalledWith(mockCode, authData);
    });

    it('should create authorization code with minimal required data', async () => {
      const mockCode = 'minimal-code-123';
      vi.mocked(randomBytes).mockReturnValue({
        toString: vi.fn().mockReturnValue(mockCode)
      } as any);

      const authData: IAuthorizationCodeData = {
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        expiresAt: new Date('2024-12-31T23:59:59Z')
      };

      const result = await authCodeService.createAuthorizationCode(authData);

      expect(result).toBe(mockCode);
      expect(mockRepository.storeAuthorizationCode).toHaveBeenCalledWith(mockCode, authData);
    });

    it('should create authorization code with all optional fields undefined', async () => {
      const mockCode = 'undefined-fields-code';
      vi.mocked(randomBytes).mockReturnValue({
        toString: vi.fn().mockReturnValue(mockCode)
      } as any);

      const authData: IAuthorizationCodeData = {
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        userId: undefined,
        userEmail: undefined,
        provider: undefined,
        providerTokens: undefined,
        codeChallenge: undefined,
        codeChallengeMethod: undefined,
        expiresAt: new Date('2024-12-31T23:59:59Z')
      };

      const result = await authCodeService.createAuthorizationCode(authData);

      expect(result).toBe(mockCode);
      expect(mockRepository.storeAuthorizationCode).toHaveBeenCalledWith(mockCode, authData);
    });

    it('should handle repository storage errors', async () => {
      const mockCode = 'error-code';
      vi.mocked(randomBytes).mockReturnValue({
        toString: vi.fn().mockReturnValue(mockCode)
      } as any);

      const repositoryError = new Error('Repository storage failed');
      mockRepository.storeAuthorizationCode.mockRejectedValue(repositoryError);

      const authData: IAuthorizationCodeData = {
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        expiresAt: new Date()
      };

      await expect(authCodeService.createAuthorizationCode(authData))
        .rejects.toThrow('Repository storage failed');
      
      expect(mockRepository.storeAuthorizationCode).toHaveBeenCalledWith(mockCode, authData);
    });

    it('should generate different codes on multiple calls', async () => {
      const mockCodes = ['code1', 'code2', 'code3'];
      let callCount = 0;
      
      vi.mocked(randomBytes).mockImplementation(() => ({
        toString: vi.fn().mockReturnValue(mockCodes[callCount++])
      } as any));

      const authData: IAuthorizationCodeData = {
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        expiresAt: new Date()
      };

      const code1 = await authCodeService.createAuthorizationCode(authData);
      const code2 = await authCodeService.createAuthorizationCode(authData);
      const code3 = await authCodeService.createAuthorizationCode(authData);

      expect(code1).toBe('code1');
      expect(code2).toBe('code2');
      expect(code3).toBe('code3');
      expect(randomBytes).toHaveBeenCalledTimes(3);
    });

    it('should handle complex provider tokens object', async () => {
      const mockCode = 'complex-tokens-code';
      vi.mocked(randomBytes).mockReturnValue({
        toString: vi.fn().mockReturnValue(mockCode)
      } as any);

      const complexTokens = {
        access_token: 'access123',
        refresh_token: 'refresh123',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'user:email',
        nested: {
          data: 'value'
        }
      };

      const authData: IAuthorizationCodeData = {
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read write',
        providerTokens: complexTokens,
        expiresAt: new Date()
      };

      const result = await authCodeService.createAuthorizationCode(authData);

      expect(result).toBe(mockCode);
      expect(mockRepository.storeAuthorizationCode).toHaveBeenCalledWith(mockCode, authData);
    });
  });

  describe('getAuthorizationCode', () => {
    it('should retrieve authorization code from repository', async () => {
      const mockAuthData: IAuthorizationCodeData = {
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read write',
        userId: 'user123',
        userEmail: 'user@example.com',
        provider: 'google',
        providerTokens: { access_token: 'token123', refresh_token: 'refresh123' },
        codeChallenge: 'challenge123',
        codeChallengeMethod: 'S256',
        expiresAt: new Date('2024-12-31T23:59:59.000Z')
      };

      mockRepository.getAuthorizationCode.mockResolvedValue(mockAuthData);

      const result = await authCodeService.getAuthorizationCode('test-code');

      expect(mockRepository.getAuthorizationCode).toHaveBeenCalledWith('test-code');
      expect(result).toEqual(mockAuthData);
    });

    it('should return null when repository returns null', async () => {
      mockRepository.getAuthorizationCode.mockResolvedValue(null);

      const result = await authCodeService.getAuthorizationCode('non-existent-code');

      expect(mockRepository.getAuthorizationCode).toHaveBeenCalledWith('non-existent-code');
      expect(result).toBeNull();
    });

    it('should handle repository returning data with minimal fields', async () => {
      const minimalAuthData: IAuthorizationCodeData = {
        clientId: 'minimal-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        expiresAt: new Date('2024-12-31T23:59:59.000Z')
      };

      mockRepository.getAuthorizationCode.mockResolvedValue(minimalAuthData);

      const result = await authCodeService.getAuthorizationCode('minimal-code');

      expect(result).toEqual(minimalAuthData);
    });

    it('should handle repository returning data with undefined optional fields', async () => {
      const authDataWithUndefined: IAuthorizationCodeData = {
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
      };

      mockRepository.getAuthorizationCode.mockResolvedValue(authDataWithUndefined);

      const result = await authCodeService.getAuthorizationCode('test-code');

      expect(result).toEqual(authDataWithUndefined);
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Repository query failed');
      mockRepository.getAuthorizationCode.mockRejectedValue(repositoryError);

      await expect(authCodeService.getAuthorizationCode('error-code'))
        .rejects.toThrow('Repository query failed');
      
      expect(mockRepository.getAuthorizationCode).toHaveBeenCalledWith('error-code');
    });

    it('should handle different code formats', async () => {
      const testCodes = [
        'simple-code',
        'code-with-dashes-123',
        'code_with_underscores_456',
        'UPPERCASE-CODE-789',
        'mixedCaseCode123',
        'base64urlEncodedCode==',
        '123456789',
        'very-long-authorization-code-with-many-characters-123456789'
      ];

      const mockAuthData: IAuthorizationCodeData = {
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        expiresAt: new Date('2024-12-31T23:59:59.000Z')
      };

      for (const code of testCodes) {
        mockRepository.getAuthorizationCode.mockResolvedValue(mockAuthData);
        
        const result = await authCodeService.getAuthorizationCode(code);
        
        expect(mockRepository.getAuthorizationCode).toHaveBeenCalledWith(code);
        expect(result).toEqual(mockAuthData);
      }

      expect(mockRepository.getAuthorizationCode).toHaveBeenCalledTimes(testCodes.length);
    });

    it('should handle complex provider tokens in returned data', async () => {
      const complexTokens = {
        access_token: 'access123',
        refresh_token: 'refresh123',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'user:email repo',
        metadata: {
          issuer: 'github',
          audience: 'api'
        }
      };

      const authDataWithComplexTokens: IAuthorizationCodeData = {
        clientId: 'github-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'repo user:email',
        provider: 'github',
        providerTokens: complexTokens,
        expiresAt: new Date('2024-12-31T23:59:59.000Z')
      };

      mockRepository.getAuthorizationCode.mockResolvedValue(authDataWithComplexTokens);

      const result = await authCodeService.getAuthorizationCode('github-code');

      expect(result?.providerTokens).toEqual(complexTokens);
    });
  });

  describe('deleteAuthorizationCode', () => {
    it('should delete authorization code via repository', async () => {
      await authCodeService.deleteAuthorizationCode('test-code');

      expect(mockRepository.deleteAuthorizationCode).toHaveBeenCalledWith('test-code');
    });

    it('should handle repository delete errors', async () => {
      const repositoryError = new Error('Repository delete failed');
      mockRepository.deleteAuthorizationCode.mockRejectedValue(repositoryError);

      await expect(authCodeService.deleteAuthorizationCode('test-code'))
        .rejects.toThrow('Repository delete failed');
      
      expect(mockRepository.deleteAuthorizationCode).toHaveBeenCalledWith('test-code');
    });

    it('should handle deletion of different code formats', async () => {
      const testCodes = [
        'simple-code',
        'code-with-special-chars-!@#',
        'UPPERCASE-CODE',
        'mixedCaseCode',
        'very-long-code-with-many-segments-123456789',
        '12345',
        'base64url-encoded=='
      ];

      for (const code of testCodes) {
        await authCodeService.deleteAuthorizationCode(code);
        expect(mockRepository.deleteAuthorizationCode).toHaveBeenCalledWith(code);
      }

      expect(mockRepository.deleteAuthorizationCode).toHaveBeenCalledTimes(testCodes.length);
    });

    it('should propagate repository timeout errors', async () => {
      const timeoutError = new Error('Connection timeout');
      timeoutError.name = 'TimeoutError';
      mockRepository.deleteAuthorizationCode.mockRejectedValue(timeoutError);

      await expect(authCodeService.deleteAuthorizationCode('timeout-code'))
        .rejects.toThrow('Connection timeout');
    });

    it('should handle repository constraint errors', async () => {
      const constraintError = new Error('Foreign key constraint violation');
      constraintError.name = 'ConstraintError';
      mockRepository.deleteAuthorizationCode.mockRejectedValue(constraintError);

      await expect(authCodeService.deleteAuthorizationCode('constraint-code'))
        .rejects.toThrow('Foreign key constraint violation');
    });
  });

  describe('cleanupExpiredCodes', () => {
    it('should cleanup expired codes via repository', async () => {
      await authCodeService.cleanupExpiredCodes();

      expect(mockRepository.cleanupExpiredCodes).toHaveBeenCalledWith();
    });

    it('should handle repository cleanup errors', async () => {
      const repositoryError = new Error('Repository cleanup failed');
      mockRepository.cleanupExpiredCodes.mockRejectedValue(repositoryError);

      await expect(authCodeService.cleanupExpiredCodes())
        .rejects.toThrow('Repository cleanup failed');
      
      expect(mockRepository.cleanupExpiredCodes).toHaveBeenCalledWith();
    });

    it('should handle database connection errors during cleanup', async () => {
      const connectionError = new Error('Database connection lost');
      connectionError.name = 'ConnectionError';
      mockRepository.cleanupExpiredCodes.mockRejectedValue(connectionError);

      await expect(authCodeService.cleanupExpiredCodes())
        .rejects.toThrow('Database connection lost');
    });

    it('should handle database lock errors during cleanup', async () => {
      const lockError = new Error('Table is locked');
      lockError.name = 'DatabaseLockError';
      mockRepository.cleanupExpiredCodes.mockRejectedValue(lockError);

      await expect(authCodeService.cleanupExpiredCodes())
        .rejects.toThrow('Table is locked');
    });

    it('should handle permission errors during cleanup', async () => {
      const permissionError = new Error('Insufficient permissions');
      permissionError.name = 'PermissionError';
      mockRepository.cleanupExpiredCodes.mockRejectedValue(permissionError);

      await expect(authCodeService.cleanupExpiredCodes())
        .rejects.toThrow('Insufficient permissions');
    });

    it('should complete successfully when no expired codes exist', async () => {
      // No error thrown, resolves successfully
      mockRepository.cleanupExpiredCodes.mockResolvedValue(undefined);

      await expect(authCodeService.cleanupExpiredCodes()).resolves.toBeUndefined();
      expect(mockRepository.cleanupExpiredCodes).toHaveBeenCalledWith();
    });
  });

  // Additional edge case tests for comprehensive coverage
  describe('Edge Cases and Error Scenarios', () => {
    it('should handle repository instance creation failure', () => {
      resetSingleton();
      
      const repositoryError = new Error('Repository initialization failed');
      vi.mocked(AuthCodeRepository.getInstance).mockImplementation(() => {
        throw repositoryError;
      });

      expect(() => AuthCodeService.getInstance()).toThrow('Repository initialization failed');
    });

    it('should handle crypto randomBytes errors', async () => {
      const cryptoError = new Error('Crypto module error');
      vi.mocked(randomBytes).mockImplementation(() => {
        throw cryptoError;
      });

      const authData: IAuthorizationCodeData = {
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        expiresAt: new Date()
      };

      await expect(authCodeService.createAuthorizationCode(authData))
        .rejects.toThrow('Crypto module error');
    });

    it('should handle toString method errors on crypto buffer', async () => {
      const toStringError = new Error('toString failed');
      vi.mocked(randomBytes).mockReturnValue({
        toString: vi.fn().mockImplementation(() => {
          throw toStringError;
        })
      } as any);

      const authData: IAuthorizationCodeData = {
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        expiresAt: new Date()
      };

      await expect(authCodeService.createAuthorizationCode(authData))
        .rejects.toThrow('toString failed');
    });

    it('should handle empty string codes', async () => {
      mockRepository.getAuthorizationCode.mockResolvedValue(null);

      const result = await authCodeService.getAuthorizationCode('');

      expect(mockRepository.getAuthorizationCode).toHaveBeenCalledWith('');
      expect(result).toBeNull();
    });

    it('should handle null codes gracefully', async () => {
      mockRepository.getAuthorizationCode.mockResolvedValue(null);

      const result = await authCodeService.getAuthorizationCode(null as any);

      expect(mockRepository.getAuthorizationCode).toHaveBeenCalledWith(null);
      expect(result).toBeNull();
    });

    it('should handle undefined codes gracefully', async () => {
      mockRepository.getAuthorizationCode.mockResolvedValue(null);

      const result = await authCodeService.getAuthorizationCode(undefined as any);

      expect(mockRepository.getAuthorizationCode).toHaveBeenCalledWith(undefined);
      expect(result).toBeNull();
    });

    it('should handle whitespace-only codes', async () => {
      mockRepository.getAuthorizationCode.mockResolvedValue(null);

      const result = await authCodeService.getAuthorizationCode('   \t\n  ');

      expect(mockRepository.getAuthorizationCode).toHaveBeenCalledWith('   \t\n  ');
      expect(result).toBeNull();
    });

    it('should handle very long authorization codes', async () => {
      const veryLongCode = 'a'.repeat(1000);
      mockRepository.getAuthorizationCode.mockResolvedValue(null);

      const result = await authCodeService.getAuthorizationCode(veryLongCode);

      expect(mockRepository.getAuthorizationCode).toHaveBeenCalledWith(veryLongCode);
      expect(result).toBeNull();
    });

    it('should handle special characters in authorization codes', async () => {
      const specialCode = 'code-with-!@#$%^&*()_+-=[]{}|;:,.<>?';
      mockRepository.getAuthorizationCode.mockResolvedValue(null);

      const result = await authCodeService.getAuthorizationCode(specialCode);

      expect(mockRepository.getAuthorizationCode).toHaveBeenCalledWith(specialCode);
      expect(result).toBeNull();
    });

    it('should handle unicode characters in authorization codes', async () => {
      const unicodeCode = 'code-with-unicode-🔐-🚀-测试';
      mockRepository.getAuthorizationCode.mockResolvedValue(null);

      const result = await authCodeService.getAuthorizationCode(unicodeCode);

      expect(mockRepository.getAuthorizationCode).toHaveBeenCalledWith(unicodeCode);
      expect(result).toBeNull();
    });
  });
});