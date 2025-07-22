/**
 * @fileoverview API repository for database operations
 * @module modules/core/api/repositories
 */

import { createHash } from 'crypto';
import type { 
  ApiKey, 
  CreateApiKeyDto, 
  ApiKeyUsage,
  ApiRequest,
  RateLimitStatus
} from '../types/api.types.js';

export class ApiRepository {
  constructor(private database: any) {}

  async createApiKey(data: CreateApiKeyDto, key: string): Promise<ApiKey> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    // Hash the key
    const keyHash = this.hashKey(key);
    const keyPrefix = key.substring(0, 8);
    
    const apiKey: ApiKey = {
      id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      user_id: data.user_id,
      name: data.name,
      scopes: data.scopes || [],
      rate_limit: data.rate_limit || 1000,
      expires_at: data.expires_in ? new Date(now.getTime() + data.expires_in) : undefined,
      created_at: now,
      metadata: data.metadata
    };

    await this.database.execute(
      `INSERT INTO api_keys (id, key_hash, key_prefix, user_id, name, scopes, 
       rate_limit, expires_at, created_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        apiKey.id,
        apiKey.key_hash,
        apiKey.key_prefix,
        apiKey.user_id,
        apiKey.name,
        JSON.stringify(apiKey.scopes),
        apiKey.rate_limit,
        apiKey.expires_at,
        apiKey.created_at,
        JSON.stringify(apiKey.metadata)
      ]
    );

    return apiKey;
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
    const results = await this.database.query(
      'SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL',
      [keyHash]
    );

    if (results.length === 0) {
      return null;
    }

    return this.mapToApiKey(results[0]);
  }

  async getApiKey(id: string): Promise<ApiKey | null> {
    const results = await this.database.query(
      'SELECT * FROM api_keys WHERE id = ?',
      [id]
    );

    if (results.length === 0) {
      return null;
    }

    return this.mapToApiKey(results[0]);
  }

  async listApiKeys(userId?: string, activeOnly: boolean = false): Promise<ApiKey[]> {
    let query = 'SELECT * FROM api_keys';
    const conditions: string[] = [];
    const params: any[] = [];

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }

    if (activeOnly) {
      conditions.push('revoked_at IS NULL');
      conditions.push('(expires_at IS NULL OR expires_at > ?)');
      params.push(new Date());
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const results = await this.database.query(query, params);
    return results.map((row: any) => this.mapToApiKey(row));
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.database.execute(
      'UPDATE api_keys SET last_used_at = ? WHERE id = ?',
      [new Date(), id]
    );
  }

  async revokeApiKey(id: string, reason?: string): Promise<boolean> {
    const result = await this.database.execute(
      'UPDATE api_keys SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND revoked_at IS NULL',
      [new Date(), reason, id]
    );
    
    return result.affectedRows > 0;
  }

  async updateRateLimit(id: string, rateLimit: number): Promise<void> {
    await this.database.execute(
      'UPDATE api_keys SET rate_limit = ? WHERE id = ?',
      [rateLimit, id]
    );
  }

  // Rate limiting
  async getRateLimitStatus(keyId: string, windowStart: Date): Promise<RateLimitStatus | null> {
    const results = await this.database.query(
      `SELECT * FROM api_rate_limits 
       WHERE key_id = ? AND window_start = ?`,
      [keyId, windowStart]
    );

    if (results.length === 0) {
      return null;
    }

    return this.mapToRateLimitStatus(results[0]);
  }

  async updateRateLimitCounter(
    keyId: string, 
    windowStart: Date, 
    windowSize: number,
    limit: number
  ): Promise<number> {
    // Try to increment existing counter
    const result = await this.database.execute(
      `UPDATE api_rate_limits 
       SET request_count = request_count + 1 
       WHERE key_id = ? AND window_start = ?`,
      [keyId, windowStart]
    );

    if (result.affectedRows === 0) {
      // Create new counter
      await this.database.execute(
        `INSERT INTO api_rate_limits (key_id, window_start, window_size, request_count, rate_limit)
         VALUES (?, ?, ?, 1, ?)`,
        [keyId, windowStart, windowSize, limit]
      );
      return 1;
    }

    // Get updated count
    const status = await this.getRateLimitStatus(keyId, windowStart);
    return status?.request_count || 1;
  }

  async resetRateLimit(keyId: string): Promise<void> {
    await this.database.execute(
      'DELETE FROM api_rate_limits WHERE key_id = ?',
      [keyId]
    );
  }

  async cleanupOldRateLimits(cutoffDate: Date): Promise<number> {
    const result = await this.database.execute(
      'DELETE FROM api_rate_limits WHERE window_start < ?',
      [cutoffDate]
    );
    
    return result.affectedRows || 0;
  }

  // Usage tracking
  async recordApiRequest(request: ApiRequest): Promise<void> {
    const id = crypto.randomUUID();
    
    await this.database.execute(
      `INSERT INTO api_requests (id, key_id, endpoint, method, status_code, 
       response_time, ip_address, user_agent, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        request.key_id,
        request.endpoint,
        request.method,
        request.status_code,
        request.response_time,
        request.ip_address,
        request.user_agent,
        request.timestamp
      ]
    );
  }

  async getApiKeyUsage(
    keyId: string, 
    periodStart: Date, 
    periodEnd: Date
  ): Promise<ApiKeyUsage> {
    const results = await this.database.query(
      `SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status_code < 400 THEN 1 END) as successful_requests,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_requests,
        MAX(timestamp) as last_request_at
       FROM api_requests
       WHERE key_id = ? AND timestamp >= ? AND timestamp < ?`,
      [keyId, periodStart, periodEnd]
    );

    const stats = results[0];

    return {
      key_id: keyId,
      total_requests: stats.total_requests || 0,
      successful_requests: stats.successful_requests || 0,
      failed_requests: stats.failed_requests || 0,
      last_request_at: stats.last_request_at ? new Date(stats.last_request_at) : undefined,
      period_start: periodStart,
      period_end: periodEnd
    };
  }

  async getOverallUsageStats(periodStart: Date, periodEnd: Date): Promise<any> {
    const results = await this.database.query(
      `SELECT 
        COUNT(*) as total_requests,
        COUNT(DISTINCT key_id) as unique_keys,
        AVG(response_time) as avg_response_time,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) * 100.0 / COUNT(*) as error_rate
       FROM api_requests
       WHERE timestamp >= ? AND timestamp < ?`,
      [periodStart, periodEnd]
    );

    const topEndpoints = await this.database.query(
      `SELECT 
        endpoint,
        method,
        COUNT(*) as request_count,
        AVG(response_time) as avg_response_time,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) * 100.0 / COUNT(*) as error_rate
       FROM api_requests
       WHERE timestamp >= ? AND timestamp < ?
       GROUP BY endpoint, method
       ORDER BY request_count DESC
       LIMIT 10`,
      [periodStart, periodEnd]
    );

    return {
      summary: results[0],
      topEndpoints
    };
  }

  async cleanupOldRequests(cutoffDate: Date): Promise<number> {
    const result = await this.database.execute(
      'DELETE FROM api_requests WHERE timestamp < ?',
      [cutoffDate]
    );
    
    return result.affectedRows || 0;
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private mapToApiKey(row: any): ApiKey {
    return {
      id: row.id,
      key_hash: row.key_hash,
      key_prefix: row.key_prefix,
      user_id: row.user_id,
      name: row.name,
      scopes: JSON.parse(row.scopes || '[]'),
      rate_limit: row.rate_limit,
      expires_at: row.expires_at ? new Date(row.expires_at) : undefined,
      last_used_at: row.last_used_at ? new Date(row.last_used_at) : undefined,
      created_at: new Date(row.created_at),
      revoked_at: row.revoked_at ? new Date(row.revoked_at) : undefined,
      revoked_reason: row.revoked_reason,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  private mapToRateLimitStatus(row: any): RateLimitStatus {
    return {
      key: row.key_id,
      limit: row.rate_limit,
      remaining: row.rate_limit - row.request_count,
      reset_at: new Date(row.window_start.getTime() + row.window_size),
      window_start: new Date(row.window_start),
      window_size: row.window_size,
      request_count: row.request_count
    };
  }
}