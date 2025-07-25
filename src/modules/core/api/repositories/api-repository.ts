/**
 * @fileoverview API repository for database operations
 * @module src/modules/core/api/repositories
 */

import type { 
  ApiKey, 
  CreateApiKeyDto, 
  RateLimitStatus, 
  ApiKeyUsage 
} from '../types/api.types.js';

export class ApiRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async createApiKey(dto: CreateApiKeyDto & { key_hash: string; key_prefix: string }): Promise<ApiKey> {
    const query = `
      INSERT INTO api_keys (
        key_hash, key_prefix, user_id, name, scopes, rate_limit, 
        expires_at, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const now = new Date();
    const scopes = JSON.stringify(dto.scopes || []);
    const metadata = JSON.stringify(dto.metadata || {});
    
    const result = await this.db.execute(query, [
      dto.key_hash,
      dto.key_prefix,
      dto.user_id,
      dto.name,
      scopes,
      dto.rate_limit || 1000,
      dto.expires_at,
      metadata,
      now
    ]);

    return {
      id: result.lastInsertRowid.toString(),
      key_hash: dto.key_hash,
      key_prefix: dto.key_prefix,
      user_id: dto.user_id,
      name: dto.name,
      scopes: dto.scopes || [],
      rate_limit: dto.rate_limit || 1000,
      expires_at: dto.expires_at || null,
      last_used_at: null,
      created_at: now,
      revoked_at: null,
      revoked_reason: null,
      metadata: dto.metadata || {}
    };
  }

  async getApiKey(id: string): Promise<ApiKey | null> {
    const query = 'SELECT * FROM api_keys WHERE id = ?';
    const result = await this.db.select(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToApiKey(result.rows[0]);
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
    const query = 'SELECT * FROM api_keys WHERE key_hash = ?';
    const result = await this.db.select(query, [keyHash]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToApiKey(result.rows[0]);
  }

  async listApiKeys(userId: string): Promise<ApiKey[]> {
    const query = 'SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC';
    const result = await this.db.select(query, [userId]);
    
    return result.rows.map((row: any) => this.mapRowToApiKey(row));
  }

  async revokeApiKey(id: string, reason: string): Promise<boolean> {
    const query = `
      UPDATE api_keys 
      SET revoked_at = ?, revoked_reason = ? 
      WHERE id = ? AND revoked_at IS NULL
    `;
    
    const result = await this.db.update(query, [new Date(), reason, id]);
    return result.changes > 0;
  }

  async updateLastUsed(id: string): Promise<void> {
    const query = 'UPDATE api_keys SET last_used_at = ? WHERE id = ?';
    await this.db.update(query, [new Date(), id]);
  }

  async getApiKeyUsage(keyId: string, timeframe: string): Promise<ApiKeyUsage> {
    // This is a simplified implementation
    // In a real implementation, you would query request logs and aggregate data
    return {
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
  }

  async recordApiRequest(keyId: string, endpoint: string, method: string, responseTime: number, success: boolean): Promise<void> {
    const query = `
      INSERT INTO api_requests (key_id, endpoint, method, response_time, success, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.execute(query, [keyId, endpoint, method, responseTime, success, new Date()]);
  }

  async getOverallUsageStats(): Promise<any> {
    // Implementation would aggregate overall usage statistics
    return {
      total_keys: 0,
      active_keys: 0,
      total_requests: 0
    };
  }

  async cleanupExpiredKeys(): Promise<number> {
    const query = 'DELETE FROM api_keys WHERE expires_at < ?';
    const result = await this.db.delete(query, [new Date()]);
    return result.changes;
  }

  async cleanupOldRateLimits(cutoffDate: Date): Promise<number> {
    const query = 'DELETE FROM rate_limits WHERE window_start < ?';
    const result = await this.db.delete(query, [cutoffDate]);
    return result.changes;
  }

  async cleanupOldRequests(): Promise<number> {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const query = 'DELETE FROM api_requests WHERE timestamp < ?';
    const result = await this.db.delete(query, [cutoffDate]);
    return result.changes;
  }

  // Rate limiting methods
  async getRateLimitStatus(keyId: string): Promise<RateLimitStatus | null> {
    const query = 'SELECT * FROM rate_limits WHERE key_id = ?';
    const result = await this.db.select(query, [keyId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      key_id: row.key_id,
      window_start: new Date(row.window_start),
      request_count: row.request_count
    };
  }

  async updateRateLimitCounter(keyId: string, windowStart: Date, windowSize: number, limit: number): Promise<void> {
    const query = `
      INSERT OR REPLACE INTO rate_limits (key_id, window_start, request_count, window_size, rate_limit)
      VALUES (?, ?, COALESCE((SELECT request_count FROM rate_limits WHERE key_id = ? AND window_start = ?) + 1, 1), ?, ?)
    `;
    
    await this.db.execute(query, [keyId, windowStart, keyId, windowStart, windowSize, limit]);
  }

  async resetRateLimit(keyId: string): Promise<void> {
    const query = 'DELETE FROM rate_limits WHERE key_id = ?';
    await this.db.delete(query, [keyId]);
  }

  async updateRateLimit(keyId: string, newLimit: number): Promise<void> {
    const query = 'UPDATE api_keys SET rate_limit = ? WHERE id = ?';
    await this.db.update(query, [newLimit, keyId]);
  }

  private mapRowToApiKey(row: any): ApiKey {
    return {
      id: row.id.toString(),
      key_hash: row.key_hash,
      key_prefix: row.key_prefix,
      user_id: row.user_id,
      name: row.name,
      scopes: JSON.parse(row.scopes || '[]'),
      rate_limit: row.rate_limit,
      expires_at: row.expires_at ? new Date(row.expires_at) : null,
      last_used_at: row.last_used_at ? new Date(row.last_used_at) : null,
      created_at: new Date(row.created_at),
      revoked_at: row.revoked_at ? new Date(row.revoked_at) : null,
      revoked_reason: row.revoked_reason,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }
}