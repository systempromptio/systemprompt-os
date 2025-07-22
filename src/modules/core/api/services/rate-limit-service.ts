/**
 * @fileoverview Rate limiting service
 * @module modules/core/api/services
 */

import type { 
  RateLimitStatus, 
  RateLimitCheck 
} from '../types/api.types.js';
import type { ApiRepository } from '../repositories/api-repository.js';

export class RateLimitService {
  private cleanupInterval?: NodeJS.Timer;
  private windowSize: number;

  constructor(
    private repository: ApiRepository,
    private config: any,
    private logger?: any
  ) {
    this.windowSize = config?.rateLimit?.windowSize || 3600000; // 1 hour default
  }

  async checkRateLimit(keyId: string, limit: number): Promise<RateLimitCheck> {
    const now = new Date();
    const windowStart = this.getWindowStart(now);
    const resetAt = new Date(windowStart.getTime() + this.windowSize);

    try {
      // Get current status
      let status = await this.repository.getRateLimitStatus(keyId, windowStart);
      
      if (!status) {
        // First request in this window
        await this.repository.updateRateLimitCounter(keyId, windowStart, this.windowSize, limit);
        
        return {
          allowed: true,
          limit,
          remaining: limit - 1,
          reset_at: resetAt
        };
      }

      const requestCount = status.request_count || 0;
      const remaining = Math.max(0, limit - requestCount);

      if (remaining > 0) {
        // Update counter
        await this.repository.updateRateLimitCounter(keyId, windowStart, this.windowSize, limit);
        
        return {
          allowed: true,
          limit,
          remaining: remaining - 1,
          reset_at: resetAt
        };
      } else {
        // Rate limit exceeded
        const retryAfter = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);
        
        return {
          allowed: false,
          limit,
          remaining: 0,
          reset_at: resetAt,
          retry_after: retryAfter
        };
      }
    } catch (error) {
      this.logger?.error('Rate limit check failed', { error, keyId });
      
      // Fail open - allow request on error
      return {
        allowed: true,
        limit,
        remaining: limit,
        reset_at: resetAt
      };
    }
  }

  async getRateLimitStatus(keyId: string, limit: number): Promise<RateLimitStatus> {
    const now = new Date();
    const windowStart = this.getWindowStart(now);
    const resetAt = new Date(windowStart.getTime() + this.windowSize);

    const status = await this.repository.getRateLimitStatus(keyId, windowStart);

    if (!status) {
      return {
        key: keyId,
        limit,
        remaining: limit,
        reset_at: resetAt,
        window_start: windowStart,
        window_size: this.windowSize
      };
    }

    return {
      key: keyId,
      limit,
      remaining: Math.max(0, limit - (status.request_count || 0)),
      reset_at: resetAt,
      window_start: windowStart,
      window_size: this.windowSize
    };
  }

  async resetRateLimit(keyId: string): Promise<void> {
    await this.repository.resetRateLimit(keyId);
    this.logger?.info('Rate limit reset', { keyId });
  }

  async updateRateLimit(keyId: string, newLimit: number): Promise<void> {
    await this.repository.updateRateLimit(keyId, newLimit);
    this.logger?.info('Rate limit updated', { keyId, newLimit });
  }

  async startCleanup(): Promise<void> {
    const interval = this.config?.rateLimit?.cleanupInterval || 300000; // 5 minutes
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(error => {
        this.logger?.error('Rate limit cleanup failed', { error });
      });
    }, interval);

    this.logger?.info('Rate limit cleanup started', { interval });
  }

  async stopCleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    
    this.logger?.info('Rate limit cleanup stopped');
  }

  private async cleanup(): Promise<void> {
    // Clean up rate limit records older than 2 windows
    const cutoffDate = new Date(Date.now() - (this.windowSize * 2));
    const deleted = await this.repository.cleanupOldRateLimits(cutoffDate);
    
    if (deleted > 0) {
      this.logger?.debug('Cleaned up old rate limits', { deleted });
    }
  }

  private getWindowStart(date: Date): Date {
    const timestamp = date.getTime();
    const windowStart = Math.floor(timestamp / this.windowSize) * this.windowSize;
    return new Date(windowStart);
  }

  formatHeaders(check: RateLimitCheck): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': check.limit.toString(),
      'X-RateLimit-Remaining': check.remaining.toString(),
      'X-RateLimit-Reset': Math.floor(check.reset_at.getTime() / 1000).toString()
    };

    if (check.retry_after) {
      headers['Retry-After'] = check.retry_after.toString();
    }

    return headers;
  }
}