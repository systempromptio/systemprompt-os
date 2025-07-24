/**
 * @fileoverview MCP Cache service for performance optimization
 * @module modules/core/mcp/services
 */

import type { Logger } from '../../../types.js';
import { DatabaseService } from '../../database/services/database.service.js';

interface CacheConfig {
  ttlSeconds: number;
  maxEntries: number;
}

interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt: Date;
  createdAt: Date;
}

export class MCPCacheService {
  private readonly memoryCache: Map<string, CacheEntry> = new Map();
  private readonly db: DatabaseService;

  constructor(
    private readonly config: CacheConfig,
    private readonly logger: Logger,
  ) {
    this.db = DatabaseService.getInstance();

    // Start cleanup interval
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Get a value from cache
   */
  get<T = any>(key: string): T | undefined {
    // Check memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      if (new Date() < memEntry.expiresAt) {
        return memEntry.value as T;
      } else {
        this.memoryCache.delete(key);
      }
    }

    // Memory cache miss, don't check database for performance
    return undefined;
  }

  /**
   * Set a value in cache
   */
  set<T = any>(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds || this.config.ttlSeconds;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const entry: CacheEntry<T> = {
      key,
      value,
      expiresAt,
      createdAt: new Date(),
    };

    // Store in memory cache
    this.memoryCache.set(key, entry);

    // Enforce max entries limit
    if (this.memoryCache.size > this.config.maxEntries) {
      this.evictOldest();
    }

    // Store in database asynchronously
    this.persistToDatabase(entry).catch((err) =>
      this.logger.error('Failed to persist cache entry', err),
    );
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): void {
    this.memoryCache.delete(key);

    // Delete from database asynchronously
    this.deleteFromDatabase(key).catch((err) =>
      this.logger.error('Failed to delete cache entry', err),
    );
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.memoryCache.clear();

    // Clear database asynchronously
    this.clearDatabase().catch((err) => this.logger.error('Failed to clear cache database', err));

    this.logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    entries: number;
    memorySize: number;
    hitRate: number;
    evictions: number;
  } {
    // Simple stats for now
    return {
      entries: this.memoryCache.size,
      memorySize: this.estimateMemorySize(),
      hitRate: 0, // TODO: Track hits/misses
      evictions: 0, // TODO: Track evictions
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache) {
      if (now > entry.expiresAt) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }

    // Clean database
    this.cleanupDatabase().catch((err) =>
      this.logger.error('Failed to cleanup cache database', err),
    );
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    const entries = Array.from(this.memoryCache.entries()).sort(
      (a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime(),
    );

    const toEvict = Math.max(1, Math.floor(this.config.maxEntries * 0.1)); // Evict 10%

    for (let i = 0; i < toEvict && i < entries.length; i++) {
      this.memoryCache?.delete(entries[i][0]);
    }
  }

  /**
   * Estimate memory size of cache
   */
  private estimateMemorySize(): number {
    let size = 0;

    for (const entry of this.memoryCache.values()) {
      size += JSON.stringify(entry).length;
    }

    return size;
  }

  /**
   * Persist cache entry to database
   */
  private async persistToDatabase(entry: CacheEntry): Promise<void> {
    try {
      await this.db.execute(
        `INSERT OR REPLACE INTO mcp_cache (key, value, expires_at, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          entry.key,
          JSON.stringify(entry.value),
          entry.expiresAt.toISOString(),
          entry.createdAt.toISOString(),
        ],
      );
    } catch (error) {
      // Ignore database errors to prevent cache from affecting main functionality
      this.logger.debug('Cache database error', error);
    }
  }

  /**
   * Delete cache entry from database
   */
  private async deleteFromDatabase(key: string): Promise<void> {
    try {
      await this.db.execute('DELETE FROM mcp_cache WHERE key = ?', [key]);
    } catch (error) {
      this.logger.debug('Cache database error', error);
    }
  }

  /**
   * Clear all entries from database
   */
  private async clearDatabase(): Promise<void> {
    try {
      await this.db.execute('DELETE FROM mcp_cache');
    } catch (error) {
      this.logger.debug('Cache database error', error);
    }
  }

  /**
   * Clean up expired entries from database
   */
  private async cleanupDatabase(): Promise<void> {
    try {
      await this.db.execute('DELETE FROM mcp_cache WHERE expires_at < ?', [
        new Date().toISOString(),
      ]);
    } catch (error) {
      this.logger.debug('Cache database error', error);
    }
  }

  /**
   * Load cache from database (for recovery)
   */
  async loadFromDatabase(): Promise<void> {
    try {
      const rows = await this.db.query<{
        key: string;
        value: string;
        expires_at: string;
        created_at: string;
      }>('SELECT * FROM mcp_cache WHERE expires_at > ?', [new Date().toISOString()]);

      for (const row of rows) {
        const entry: CacheEntry = {
          key: row.key,
          value: JSON.parse(row.value),
          expiresAt: new Date(row.expires_at),
          createdAt: new Date(row.created_at),
        };

        this.memoryCache.set(row.key, entry);
      }

      this.logger.info(`Loaded ${rows.length} cache entries from database`);
    } catch (error) {
      this.logger.error('Failed to load cache from database', error);
    }
  }
}
