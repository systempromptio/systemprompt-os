/**
 * @fileoverview API key management service
 * @module modules/core/api/services
 */

import { randomBytes } from 'crypto';
import type { 
  ApiKey, 
  ApiKeyInfo,
  CreateApiKeyDto, 
  ApiKeyValidation,
  ApiKeyUsage,
  ApiRequest,
  UsageStats
} from '../types/api.types.js';
import type { ApiRepository } from '../repositories/api-repository.js';
import type { RateLimitService } from './rate-limit-service.js';

export class ApiKeyService {
  private keyPrefix: string;

  constructor(
    private repository: ApiRepository,
    private rateLimitService: RateLimitService,
    private logger?: any
  ) {
    this.keyPrefix = 'sk_';
  }

  async createApiKey(data: CreateApiKeyDto): Promise<ApiKeyInfo> {
    try {
      // Generate secure random key
      const keyBytes = randomBytes(32);
      const key = this.keyPrefix + keyBytes.toString('base64url');

      // Create key in database
      const apiKey = await this.repository.createApiKey(data, key);

      this.logger?.info('API key created', { 
        keyId: apiKey.id,
        userId: data.user_id,
        name: data.name 
      });

      // Return info with the actual key (only time it's shown)
      return this.mapToApiKeyInfo(apiKey, key);
    } catch (error) {
      this.logger?.error('Failed to create API key', { error, data });
      throw error;
    }
  }

  async validateApiKey(key: string): Promise<ApiKeyValidation> {
    try {
      // Check key format
      if (!key || !key.startsWith(this.keyPrefix)) {
        return {
          valid: false,
          error: 'Invalid key format'
        };
      }

      // Hash and lookup
      const keyHash = this.hashKey(key);
      const apiKey = await this.repository.getApiKeyByHash(keyHash);

      if (!apiKey) {
        return {
          valid: false,
          error: 'Key not found'
        };
      }

      // Check if revoked
      if (apiKey.revoked_at) {
        return {
          valid: false,
          error: 'Key has been revoked'
        };
      }

      // Check expiration
      if (apiKey.expires_at && apiKey.expires_at < new Date()) {
        return {
          valid: false,
          error: 'Key has expired'
        };
      }

      // Update last used
      await this.repository.updateLastUsed(apiKey.id);

      return {
        valid: true,
        key_id: apiKey.id,
        user_id: apiKey.user_id,
        scopes: apiKey.scopes,
        rate_limit: apiKey.rate_limit
      };
    } catch (error) {
      this.logger?.error('API key validation error', { error });
      return {
        valid: false,
        error: 'Validation error'
      };
    }
  }

  async revokeApiKey(key: string, reason?: string): Promise<void> {
    try {
      // Validate key format
      if (!key || !key.startsWith(this.keyPrefix)) {
        throw new Error('Invalid key format');
      }

      // Find key by hash
      const keyHash = this.hashKey(key);
      const apiKey = await this.repository.getApiKeyByHash(keyHash);

      if (!apiKey) {
        throw new Error('Key not found');
      }

      // Revoke key
      const revoked = await this.repository.revokeApiKey(apiKey.id, reason);
      
      if (!revoked) {
        throw new Error('Key already revoked');
      }

      // Reset rate limits
      await this.rateLimitService.resetRateLimit(apiKey.id);

      this.logger?.info('API key revoked', { 
        keyId: apiKey.id,
        reason 
      });
    } catch (error) {
      this.logger?.error('Failed to revoke API key', { error });
      throw error;
    }
  }

  async getApiKey(id: string): Promise<ApiKeyInfo | null> {
    const apiKey = await this.repository.getApiKey(id);
    
    if (!apiKey) {
      return null;
    }

    return this.mapToApiKeyInfo(apiKey);
  }

  async listApiKeys(userId?: string, activeOnly: boolean = false): Promise<ApiKeyInfo[]> {
    const keys = await this.repository.listApiKeys(userId, activeOnly);
    return keys.map(key => this.mapToApiKeyInfo(key));
  }

  async getApiKeyUsage(
    keyId: string, 
    period: string = '24h'
  ): Promise<ApiKeyUsage> {
    const now = new Date();
    const periodStart = this.getPeriodStart(now, period);
    
    return this.repository.getApiKeyUsage(keyId, periodStart, now);
  }

  async recordApiRequest(
    keyId: string,
    request: Omit<ApiRequest, 'key_id' | 'timestamp'>
  ): Promise<void> {
    await this.repository.recordApiRequest({
      key_id: keyId,
      timestamp: new Date(),
      ...request
    });
  }

  async getUsageStats(period: string = '24h'): Promise<UsageStats> {
    const now = new Date();
    const periodStart = this.getPeriodStart(now, period);
    
    const stats = await this.repository.getOverallUsageStats(periodStart, now);
    
    return {
      period,
      total_requests: stats.summary.total_requests || 0,
      unique_keys: stats.summary.unique_keys || 0,
      average_response_time: Math.round(stats.summary.avg_response_time || 0),
      error_rate: Math.round((stats.summary.error_rate || 0) * 100) / 100,
      top_endpoints: stats.topEndpoints.map((endpoint: any) => ({
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        request_count: endpoint.request_count,
        average_response_time: Math.round(endpoint.avg_response_time || 0),
        error_rate: Math.round((endpoint.error_rate || 0) * 100) / 100
      }))
    };
  }

  async updateRateLimit(keyId: string, newLimit: number): Promise<void> {
    try {
      await this.rateLimitService.updateRateLimit(keyId, newLimit);
      this.logger?.info('API key rate limit updated', { keyId, newLimit });
    } catch (error) {
      this.logger?.error('Failed to update rate limit', { error, keyId });
      throw error;
    }
  }

  private hashKey(key: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  private mapToApiKeyInfo(apiKey: ApiKey, actualKey?: string): ApiKeyInfo {
    return {
      id: apiKey.id,
      key: actualKey, // Only included on creation
      key_prefix: apiKey.key_prefix,
      user_id: apiKey.user_id,
      name: apiKey.name,
      scopes: apiKey.scopes,
      rate_limit: apiKey.rate_limit,
      expires_at: apiKey.expires_at,
      last_used_at: apiKey.last_used_at,
      created_at: apiKey.created_at,
      is_active: !apiKey.revoked_at && (!apiKey.expires_at || apiKey.expires_at > new Date())
    };
  }

  private getPeriodStart(now: Date, period: string): Date {
    const match = period.match(/^(\d+)([hdwmy])$/);
    if (!match) {
      throw new Error('Invalid period format');
    }

    const value = parseInt(match[1]);
    const unit = match[2];
    
    const periodStart = new Date(now);
    
    switch (unit) {
      case 'h':
        periodStart.setHours(periodStart.getHours() - value);
        break;
      case 'd':
        periodStart.setDate(periodStart.getDate() - value);
        break;
      case 'w':
        periodStart.setDate(periodStart.getDate() - (value * 7));
        break;
      case 'm':
        periodStart.setMonth(periodStart.getMonth() - value);
        break;
      case 'y':
        periodStart.setFullYear(periodStart.getFullYear() - value);
        break;
    }

    return periodStart;
  }
}