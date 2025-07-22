/**
 * @fileoverview Unit tests for API key service
 * @module tests/unit/modules/core/api
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiKeyService } from '../../../../../src/modules/core/api/services/api-key-service.js';
import type { ApiRepository } from '../../../../../src/modules/core/api/repositories/api-repository.js';
import type { RateLimitService } from '../../../../../src/modules/core/api/services/rate-limit-service.js';
import type { ApiKey, CreateApiKeyDto } from '../../../../../src/modules/core/api/types/api.types.js';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let mockRepository: jest.Mocked<ApiRepository>;
  let mockRateLimitService: jest.Mocked<RateLimitService>;
  let mockLogger: any;

  beforeEach(() => {
    // Mock repository
    mockRepository = {
      createApiKey: vi.fn(),
      getApiKey: vi.fn(),
      getApiKeyByHash: vi.fn(),
      listApiKeys: vi.fn(),
      revokeApiKey: vi.fn(),
      updateLastUsed: vi.fn(),
      getApiKeyUsage: vi.fn(),
      recordApiRequest: vi.fn(),
      getOverallUsageStats: vi.fn(),
      cleanupExpiredKeys: vi.fn(),
      cleanupOldRateLimits: vi.fn(),
      cleanupOldRequests: vi.fn()
    } as any;

    // Mock rate limit service
    mockRateLimitService = {
      checkRateLimit: vi.fn(),
      updateRateLimit: vi.fn(),
      resetRateLimit: vi.fn(),
      getRateLimitStatus: vi.fn()
    } as any;

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    service = new ApiKeyService(mockRepository, mockRateLimitService, mockLogger);
  });

  describe('createApiKey', () => {
    it('should create a new API key', async () => {
      const createDto: CreateApiKeyDto = {
        user_id: 'user123',
        name: 'Test API Key',
        scopes: ['read', 'write'],
        rate_limit: 5000
      };

      const mockApiKey: ApiKey = {
        id: 'key123',
        key_hash: 'hash123',
        key_prefix: 'sk_abc',
        user_id: 'user123',
        name: 'Test API Key',
        scopes: ['read', 'write'],
        rate_limit: 5000,
        expires_at: null,
        last_used_at: null,
        created_at: new Date(),
        revoked_at: null,
        revoked_reason: null,
        metadata: {}
      };

      mockRepository.createApiKey.mockResolvedValue(mockApiKey);

      const result = await service.createApiKey(createDto);

      expect(result).toMatchObject({
        id: 'key123',
        key: expect.stringContaining('sk_'),
        key_prefix: 'sk_abc',
        user_id: 'user123',
        name: 'Test API Key',
        scopes: ['read', 'write'],
        rate_limit: 5000
      });
      expect(mockRepository.createApiKey).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('API key created', expect.any(Object));
    });

    it('should handle creation errors', async () => {
      const createDto: CreateApiKeyDto = {
        user_id: 'user123',
        name: 'Test API Key'
      };

      mockRepository.createApiKey.mockRejectedValue(new Error('Database error'));

      await expect(service.createApiKey(createDto)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('validateApiKey', () => {
    it('should validate a valid API key', async () => {
      const testKey = 'sk_testkey123';
      const mockApiKey: ApiKey = {
        id: 'key123',
        key_hash: 'hash123',
        key_prefix: 'sk_test',
        user_id: 'user123',
        name: 'Test API Key',
        scopes: ['read'],
        rate_limit: 1000,
        expires_at: null,
        last_used_at: null,
        created_at: new Date(),
        revoked_at: null,
        revoked_reason: null,
        metadata: {}
      };

      mockRepository.getApiKeyByHash.mockResolvedValue(mockApiKey);
      mockRepository.updateLastUsed.mockResolvedValue(undefined);

      const result = await service.validateApiKey(testKey);

      expect(result.valid).toBe(true);
      expect(result.key_id).toBe('key123');
      expect(result.user_id).toBe('user123');
      expect(result.scopes).toEqual(['read']);
      expect(mockRepository.updateLastUsed).toHaveBeenCalledWith('key123');
    });

    it('should reject invalid key format', async () => {
      const result = await service.validateApiKey('invalid_key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid key format');
      expect(mockRepository.getApiKeyByHash).not.toHaveBeenCalled();
    });

    it('should reject non-existent key', async () => {
      mockRepository.getApiKeyByHash.mockResolvedValue(null);

      const result = await service.validateApiKey('sk_notfound');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Key not found');
    });

    it('should reject revoked key', async () => {
      const mockApiKey: ApiKey = {
        id: 'key123',
        key_hash: 'hash123',
        key_prefix: 'sk_test',
        user_id: 'user123',
        name: 'Test API Key',
        scopes: [],
        rate_limit: 1000,
        expires_at: null,
        last_used_at: null,
        created_at: new Date(),
        revoked_at: new Date(),
        revoked_reason: 'Security breach',
        metadata: {}
      };

      mockRepository.getApiKeyByHash.mockResolvedValue(mockApiKey);

      const result = await service.validateApiKey('sk_revoked');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Key has been revoked');
    });

    it('should reject expired key', async () => {
      const mockApiKey: ApiKey = {
        id: 'key123',
        key_hash: 'hash123',
        key_prefix: 'sk_test',
        user_id: 'user123',
        name: 'Test API Key',
        scopes: [],
        rate_limit: 1000,
        expires_at: new Date('2020-01-01'),
        last_used_at: null,
        created_at: new Date(),
        revoked_at: null,
        revoked_reason: null,
        metadata: {}
      };

      mockRepository.getApiKeyByHash.mockResolvedValue(mockApiKey);

      const result = await service.validateApiKey('sk_expired');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Key has expired');
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an API key', async () => {
      const testKey = 'sk_testkey123';
      const mockApiKey: ApiKey = {
        id: 'key123',
        key_hash: 'hash123',
        key_prefix: 'sk_test',
        user_id: 'user123',
        name: 'Test API Key',
        scopes: [],
        rate_limit: 1000,
        expires_at: null,
        last_used_at: null,
        created_at: new Date(),
        revoked_at: null,
        revoked_reason: null,
        metadata: {}
      };

      mockRepository.getApiKeyByHash.mockResolvedValue(mockApiKey);
      mockRepository.revokeApiKey.mockResolvedValue(true);
      mockRateLimitService.resetRateLimit.mockResolvedValue(undefined);

      await service.revokeApiKey(testKey, 'Security reason');

      expect(mockRepository.revokeApiKey).toHaveBeenCalledWith('key123', 'Security reason');
      expect(mockRateLimitService.resetRateLimit).toHaveBeenCalledWith('key123');
      expect(mockLogger.info).toHaveBeenCalledWith('API key revoked', expect.any(Object));
    });

    it('should handle already revoked key', async () => {
      const testKey = 'sk_testkey123';
      const mockApiKey: ApiKey = {
        id: 'key123',
        key_hash: 'hash123',
        key_prefix: 'sk_test',
        user_id: 'user123',
        name: 'Test API Key',
        scopes: [],
        rate_limit: 1000,
        expires_at: null,
        last_used_at: null,
        created_at: new Date(),
        revoked_at: new Date(),
        revoked_reason: 'Already revoked',
        metadata: {}
      };

      mockRepository.getApiKeyByHash.mockResolvedValue(mockApiKey);
      mockRepository.revokeApiKey.mockResolvedValue(false);

      await expect(service.revokeApiKey(testKey)).rejects.toThrow('Key already revoked');
    });
  });

  describe('getApiKeyUsage', () => {
    it('should return API key usage statistics', async () => {
      const mockUsage = {
        total_requests: 150,
        error_rate: 2.5,
        average_response_time: 45,
        top_endpoints: [
          {
            endpoint: '/api/data',
            method: 'GET',
            request_count: 100,
            average_response_time: 40,
            error_rate: 1.0
          }
        ]
      };

      mockRepository.getApiKeyUsage.mockResolvedValue(mockUsage);

      const result = await service.getApiKeyUsage('key123', '24h');

      expect(result).toEqual(mockUsage);
      expect(mockRepository.getApiKeyUsage).toHaveBeenCalled();
    });
  });

  describe('updateRateLimit', () => {
    it('should update rate limit for a key', async () => {
      mockRateLimitService.updateRateLimit.mockResolvedValue(undefined);

      await service.updateRateLimit('key123', 5000);

      expect(mockRateLimitService.updateRateLimit).toHaveBeenCalledWith('key123', 5000);
      expect(mockLogger.info).toHaveBeenCalledWith('API key rate limit updated', expect.any(Object));
    });

    it('should handle update errors', async () => {
      mockRateLimitService.updateRateLimit.mockRejectedValue(new Error('Update failed'));

      await expect(service.updateRateLimit('key123', 5000)).rejects.toThrow('Update failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});