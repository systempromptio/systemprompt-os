/**
 * @file Rate limiting service for API keys.
 * @module src/modules/core/api/services
 */

import type { ApiRepository } from '@/modules/core/api/repositories/api-repository';
import type {
  RateLimitResult,
  RateLimitStatusResponse
} from '@/modules/core/api/types/api.types';

export class RateLimitService {
  private readonly repository: ApiRepository;
  private readonly config: any;
  private readonly logger: any;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(repository: ApiRepository, config: any, logger: any) {
    this.repository = repository;
    this.config = config;
    this.logger = logger;
  }

  async checkRateLimit(keyId: string, limit: number): Promise<RateLimitResult> {
    try {
      const windowSize = this.config.rateLimit?.windowSize || 3600000
      const currentTime = new Date();
      const windowStart = new Date(Math.floor(currentTime.getTime() / windowSize) * windowSize);

      const status = await this.repository.getRateLimitStatus(keyId);

      if (!status) {
        await this.repository.updateRateLimitCounter(keyId, windowStart, windowSize, limit);
        return {
          allowed: true,
          limit,
          remaining: limit - 1
        };
      }

      if (status.window_start.getTime() === windowStart.getTime()) {
        if (status.request_count >= limit) {
          const resetTime = new Date(windowStart.getTime() + windowSize);
          return {
            allowed: false,
            limit,
            remaining: 0,
            retry_after: resetTime
          };
        }
          await this.repository.updateRateLimitCounter(keyId, windowStart, windowSize, limit);
          return {
            allowed: true,
            limit,
            remaining: limit - status.request_count - 1
          };
      }
        await this.repository.updateRateLimitCounter(keyId, windowStart, windowSize, limit);
        return {
          allowed: true,
          limit,
          remaining: limit - 1
        };
    } catch (error) {
      this.logger.error('Rate limit check failed', {
 keyId,
error: error.message
});
      return {
        allowed: true,
        limit,
        remaining: limit
      };
    }
  }

  async getRateLimitStatus(keyId: string, limit: number): Promise<RateLimitStatusResponse> {
    const windowSize = this.config.rateLimit?.windowSize || 3600000;
    const currentTime = new Date();
    const windowStart = new Date(Math.floor(currentTime.getTime() / windowSize) * windowSize);
    const resetAt = new Date(windowStart.getTime() + windowSize);

    const status = await this.repository.getRateLimitStatus(keyId);

    if (!status || status.window_start.getTime() !== windowStart.getTime()) {
      return {
        key: keyId,
        limit,
        remaining: limit,
        window_size: windowSize,
        reset_at: resetAt
      };
    }

    return {
      key: keyId,
      limit,
      remaining: Math.max(0, limit - status.request_count),
      window_size: windowSize,
      reset_at: resetAt
    };
  }

  async resetRateLimit(keyId: string): Promise<void> {
    await this.repository.resetRateLimit(keyId);
    this.logger.info('Rate limit reset', { keyId });
  }

  async updateRateLimit(keyId: string, newLimit: number): Promise<void> {
    await this.repository.updateRateLimit(keyId, newLimit);
    this.logger.info('Rate limit updated', {
 keyId,
newLimit
});
  }

  async startCleanup(): Promise<void> {
    const interval = this.config.rateLimit?.cleanupInterval || 300000

    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(error => {
        this.logger.error('Rate limit cleanup error', { error: error.message });
      });
    }, interval);

    this.logger.info('Rate limit cleanup started', { interval });
  }

  async stopCleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info('Rate limit cleanup stopped');
    }
  }

  private async cleanup(): Promise<void> {
    const windowSize = this.config.rateLimit?.windowSize || 3600000;
    const cutoffTime = new Date(Date.now() - windowSize * 2)

    const deleted = await this.repository.cleanupOldRateLimits(cutoffTime);

    if (deleted > 0) {
      this.logger.debug('Cleaned up old rate limits', { deleted });
    }
  }
}
