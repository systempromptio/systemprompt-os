/**
 * @fileoverview Unit tests for rate limit service
 * @module tests/unit/modules/core/api
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimitService } from '../../../../../src/modules/core/api/services/rate-limit-service.js';
import type { ApiRepository } from '../../../../../src/modules/core/api/repositories/api-repository.js';
import type { RateLimitStatus } from '../../../../../src/modules/core/api/types/api.types.js';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let mockRepository: jest.Mocked<ApiRepository>;
  let mockConfig: any;
  let mockLogger: any;

  beforeEach(() => {
    // Mock repository
    mockRepository = {
      getRateLimitStatus: vi.fn(),
      updateRateLimitCounter: vi.fn(),
      resetRateLimit: vi.fn(),
      updateRateLimit: vi.fn(),
      cleanupOldRateLimits: vi.fn()
    } as any;

    // Mock config
    mockConfig = {
      rateLimit: {
        windowSize: 3600000,
        cleanupInterval: 300000
      }
    };

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    service = new RateLimitService(mockRepository, mockConfig, mockLogger);
  });

  describe('checkRateLimit', () => {
    it('should allow request within rate limit', async () => {
      const mockStatus = {
        key_id: 'key123',
        window_start: new Date(),
        request_count: 50
      };

      mockRepository.getRateLimitStatus.mockResolvedValue(mockStatus);
      mockRepository.updateRateLimitCounter.mockResolvedValue(undefined);

      const result = await service.checkRateLimit('key123', 100);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(49);
      expect(mockRepository.updateRateLimitCounter).toHaveBeenCalledWith('key123', expect.any(Date), 3600000, 100);
    });

    it('should deny request exceeding rate limit', async () => {
      const mockStatus = {
        key_id: 'key123',
        window_start: new Date(),
        request_count: 100
      };

      mockRepository.getRateLimitStatus.mockResolvedValue(mockStatus);

      const result = await service.checkRateLimit('key123', 100);

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(0);
      expect(result.retry_after).toBeDefined();
      expect(mockRepository.updateRateLimitCounter).not.toHaveBeenCalled();
    });

    it('should create new window when none exists', async () => {
      mockRepository.getRateLimitStatus.mockResolvedValue(null);
      mockRepository.updateRateLimitCounter.mockResolvedValue(undefined);

      const result = await service.checkRateLimit('key123', 100);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(99);
      expect(mockRepository.updateRateLimitCounter).toHaveBeenCalledWith(
        'key123',
        expect.any(Date),
        3600000,
        100
      );
    });

    it('should handle rate limit errors gracefully', async () => {
      mockRepository.getRateLimitStatus.mockRejectedValue(new Error('Database error'));

      const result = await service.checkRateLimit('key123', 100);

      // Should fail open on error
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(100);
      expect(mockLogger.error).toHaveBeenCalledWith('Rate limit check failed', expect.any(Object));
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current rate limit status', async () => {
      const mockStatus = {
        key_id: 'key123',
        window_start: new Date(),
        request_count: 50
      };

      mockRepository.getRateLimitStatus.mockResolvedValue(mockStatus);

      const result = await service.getRateLimitStatus('key123', 100);

      expect(result).toMatchObject({
        key: 'key123',
        limit: 100,
        remaining: 50,
        window_size: 3600000
      });
      expect(result.reset_at).toBeInstanceOf(Date);
    });

    it('should return zero usage when no window exists', async () => {
      mockRepository.getRateLimitStatus.mockResolvedValue(null);

      const result = await service.getRateLimitStatus('key123', 1000);

      expect(result).toMatchObject({
        key: 'key123',
        limit: 1000,
        remaining: 1000,
        window_size: 3600000
      });
      expect(result.reset_at).toBeInstanceOf(Date);
    });

    it('should handle status check errors', async () => {
      mockRepository.getRateLimitStatus.mockRejectedValue(new Error('Database error'));

      await expect(service.getRateLimitStatus('key123', 100)).rejects.toThrow('Database error');
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for a key', async () => {
      mockRepository.resetRateLimit.mockResolvedValue(undefined);

      await service.resetRateLimit('key123');

      expect(mockRepository.resetRateLimit).toHaveBeenCalledWith('key123');
      expect(mockLogger.info).toHaveBeenCalledWith('Rate limit reset', { keyId: 'key123' });
    });

    it('should handle reset errors', async () => {
      mockRepository.resetRateLimit.mockRejectedValue(new Error('Reset failed'));

      await expect(service.resetRateLimit('key123')).rejects.toThrow('Reset failed');
    });
  });

  describe('updateRateLimit', () => {
    it('should update rate limit for a key', async () => {
      mockRepository.updateRateLimit.mockResolvedValue(undefined);

      await service.updateRateLimit('key123', 5000);

      expect(mockRepository.updateRateLimit).toHaveBeenCalledWith('key123', 5000);
      expect(mockLogger.info).toHaveBeenCalledWith('Rate limit updated', expect.any(Object));
    });

    it('should handle update errors', async () => {
      mockRepository.updateRateLimit.mockRejectedValue(new Error('Update failed'));

      await expect(service.updateRateLimit('key123', 5000)).rejects.toThrow('Update failed');
    });
  });

  describe('cleanup', () => {
    it('should cleanup old rate limit windows', async () => {
      mockRepository.cleanupOldRateLimits.mockResolvedValue(5);

      await (service as any).cleanup();

      expect(mockRepository.cleanupOldRateLimits).toHaveBeenCalledWith(expect.any(Date));
      expect(mockLogger.debug).toHaveBeenCalledWith('Cleaned up old rate limits', { deleted: 5 });
    });

    it('should handle cleanup errors silently', async () => {
      mockRepository.cleanupOldRateLimits.mockResolvedValue(0);

      await (service as any).cleanup();

      expect(mockRepository.cleanupOldRateLimits).toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe('startCleanup', () => {
    it('should start cleanup interval', async () => {
      vi.useFakeTimers();
      
      await service.startCleanup();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Rate limit cleanup started', { interval: 300000 });
      
      vi.clearAllTimers();
      vi.useRealTimers();
    });
  });

  describe('stopCleanup', () => {
    it('should stop cleanup interval', async () => {
      vi.useFakeTimers();
      
      await service.startCleanup();
      await service.stopCleanup();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Rate limit cleanup stopped');
      
      vi.clearAllTimers();
      vi.useRealTimers();
    });
  });
});