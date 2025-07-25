/**
 * @fileoverview Rate limiting service for API keys
 * @module src/modules/core/api/services
 */

import type { ApiRepository } from '../repositories/api-repository.js';
import type { 
  RateLimitResult, 
  RateLimitStatusResponse 
} from '../types/api.types.js';

export class RateLimitService {
  private repository: ApiRepository;
  private config: any;
  private logger: any;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(repository: ApiRepository, config: any, logger: any) {
    this.repository = repository;
    this.config = config;
    this.logger = logger;
  }

  async checkRateLimit(keyId: string, limit: number): Promise<RateLimitResult> {
    try {
      const windowSize = this.config.rateLimit?.windowSize || 3600000; // 1 hour default
      const currentTime = new Date();
      const windowStart = new Date(Math.floor(currentTime.getTime() / windowSize) * windowSize);

      // Get current rate limit status
      const status = await this.repository.getRateLimitStatus(keyId);

      if (!status) {
        // No existing window, create new one
        await this.repository.updateRateLimitCounter(keyId, windowStart, windowSize, limit);
        return {
          allowed: true,
          limit,
          remaining: limit - 1
        };
      }

      // Check if we're in the same window
      if (status.window_start.getTime() === windowStart.getTime()) {
        if (status.request_count >= limit) {
          // Rate limit exceeded
          const resetTime = new Date(windowStart.getTime() + windowSize);
          return {
            allowed: false,
            limit,
            remaining: 0,
            retry_after: resetTime
          };
        } else {
          // Still within limit, increment counter
          await this.repository.updateRateLimitCounter(keyId, windowStart, windowSize, limit);
          return {
            allowed: true,
            limit,
            remaining: limit - status.request_count - 1
          };
        }
      } else {
        // New window, reset counter
        await this.repository.updateRateLimitCounter(keyId, windowStart, windowSize, limit);
        return {
          allowed: true,
          limit,
          remaining: limit - 1
        };
      }
    } catch (error) {
      this.logger.error('Rate limit check failed', { keyId, error: error.message });
      // Fail open - allow the request if there's an error
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
      // No current window or old window
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
    this.logger.info('Rate limit updated', { keyId, newLimit });
  }

  async startCleanup(): Promise<void> {
    const interval = this.config.rateLimit?.cleanupInterval || 300000; // 5 minutes default
    
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
    const cutoffTime = new Date(Date.now() - windowSize * 2); // Keep 2 windows of history
    
    const deleted = await this.repository.cleanupOldRateLimits(cutoffTime);
    
    if (deleted > 0) {
      this.logger.debug('Cleaned up old rate limits', { deleted });
    }
  }
}