/**
 * Token repository for token data access operations.
 * @module modules/core/auth/repositories/token.repository
 */

import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IAuthTokensRow } from '@/modules/core/auth/types/database.generated';
import { ZERO } from '@/constants/numbers';

/**
 * TokenRepository class for handling token data operations.
 */
export class TokenRepository {
  private static instance: TokenRepository;
  private dbService?: DatabaseService;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   * @returns TokenRepository instance.
   */
  public static getInstance(): TokenRepository {
    TokenRepository.instance ||= new TokenRepository();
    return TokenRepository.instance;
  }

  /**
   * Reset singleton instance (for testing).
   */
  public static reset(): void {
    TokenRepository.instance = undefined as any;
  }

  /**
   * Initialize repository.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    // Database will be fetched lazily via getDatabase()
    this.dbService = undefined;
  }

  /**
   * Get database connection.
   * @returns Database connection.
   */
  private async getDatabase(): Promise<DatabaseService> {
    if (!this.dbService) {
      try {
        // Try to get from module registry first
        const { getDatabaseModule } = await import('@/modules/core/database/index');
        const databaseModule = getDatabaseModule();
        this.dbService = databaseModule.exports.service();
      } catch (error) {
        // Fallback to direct import if module not available in registry
        const { DatabaseService } = await import('@/modules/core/database/services/database.service');
        this.dbService = DatabaseService.getInstance();
      }
    }
    return this.dbService;
  }

  /**
   * Insert a new token into the database.
   * @param id - Token ID.
   * @param userId - User ID.
   * @param hashedToken - Hashed token value.
   * @param type - Token type.
   * @param name - Token name.
   * @param scopes - Token scopes array.
   * @param expiresAt - Expiration timestamp.
   * @returns Promise that resolves when insert is complete.
   */
  async insertToken(
    id: string,
    userId: string,
    hashedToken: string,
    type: string,
    name: string,
    scopes: string[],
    expiresAt: string | null,
  ): Promise<void> {
    const db = await this.getDatabase();
    await db.execute(
      `INSERT INTO auth_tokens
       (id, user_id, name, token_hash, type, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, name, hashedToken, type, expiresAt],
    );

    for (const scope of scopes) {
      const db = await this.getDatabase();
    await db.execute(
        'INSERT INTO auth_token_scopes (token_id, scope) VALUES (?, ?)',
        [id, scope],
      );
    }
  }

  /**
   * Query tokens from the database.
   * @param sql - SQL query string.
   * @param params - Query parameters.
   * @returns Promise resolving to query results.
   */
  async queryTokens<T = IAuthTokensRow>(sql: string, params?: unknown[]): Promise<T[]> {
    const db = await this.getDatabase();
    return await db.query<T>(sql, params);
  }

  /**
   * Execute a token-related database command.
   * @param sql - SQL command string.
   * @param params - Command parameters.
   * @returns Promise that resolves when command is complete.
   */
  async executeCommand(sql: string, params?: unknown[]): Promise<void> {
    const db = await this.getDatabase();
    await db.execute(sql, params);
  }

  /**
   * Find token by ID and hash.
   * @param tokenId - Token ID.
   * @param hashedToken - Hashed token value.
   * @returns Promise resolving to token data or null.
   */
  async findTokenByIdAndHash(tokenId: string, hashedToken: string): Promise<IAuthTokensRow | null> {
    const db = await this.getDatabase();
    const result = await db.query<IAuthTokensRow>(
      'SELECT * FROM auth_tokens WHERE id = ? AND token_hash = ?',
      [tokenId, hashedToken],
    );
    return result[ZERO] ?? null;
  }

  /**
   * Get token scopes.
   * @param tokenId - Token ID.
   * @returns Promise resolving to array of scopes.
   */
  async getTokenScopes(tokenId: string): Promise<string[]> {
    const db = await this.getDatabase();
    const result = await db.query<{ scope: string }>(
      'SELECT scope FROM auth_token_scopes WHERE token_id = ?',
      [tokenId],
    );
    return result.map(row => { return row.scope });
  }

  /**
   * Find tokens by user ID.
   * @param userId - User ID.
   * @returns Promise resolving to array of token data.
   */
  async findTokensByUserId(userId: string): Promise<IAuthTokensRow[]> {
    const db = await this.getDatabase();
    return await db.query<IAuthTokensRow>(
      `SELECT * FROM auth_tokens
       WHERE user_id = ? AND is_revoked = 0
       ORDER BY created_at DESC`,
      [userId],
    );
  }

  /**
   * Revoke a token by ID.
   * @param tokenId - Token ID to revoke.
   * @returns Promise that resolves when revocation is complete.
   */
  async revokeToken(tokenId: string): Promise<void> {
    const db = await this.getDatabase();
    await db.execute(
      'UPDATE auth_tokens SET is_revoked = true WHERE id = ?',
      [tokenId],
    );
  }

  /**
   * Revoke user tokens.
   * @param userId - User ID.
   * @param type - Optional token type filter.
   * @returns Promise that resolves when revocation is complete.
   */
  async revokeUserTokens(userId: string, type?: string): Promise<void> {
    let sql = 'UPDATE auth_tokens SET is_revoked = true WHERE user_id = ?';
    const params: unknown[] = [userId];

    if (type !== undefined && type !== null) {
      sql += ' AND type = ?';
      params.push(type);
    }

    const db = await this.getDatabase();
    await db.execute(sql, params);
  }

  /**
   * Count expired tokens.
   * @returns Promise resolving to count of expired tokens.
   */
  async countExpiredTokens(): Promise<number> {
    const db = await this.getDatabase();
    const result = await db.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM auth_tokens WHERE expires_at < datetime('now')",
    );
    return result[ZERO]?.count ?? ZERO;
  }

  /**
   * Delete expired tokens.
   * @returns Promise that resolves when deletion is complete.
   */
  async deleteExpiredTokens(): Promise<void> {
    const db = await this.getDatabase();
    await db.execute(
      "DELETE FROM auth_tokens WHERE expires_at < datetime('now')",
    );
  }

  /**
   * Update token usage timestamp.
   * @param tokenId - Token ID to update.
   * @returns Promise that resolves when update is complete.
   */
  async updateTokenUsage(tokenId: string): Promise<void> {
    const db = await this.getDatabase();
    await db.execute(
      'UPDATE auth_tokens SET last_used_at = datetime(\'now\') WHERE id = ?',
      [tokenId],
    );
  }
}
