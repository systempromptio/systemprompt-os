/**
 * Audit repository for authentication events data access.
 * @module modules/core/auth/repositories/audit.repository
 */

import { randomUUID } from 'node:crypto';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IAuditRow } from '@/modules/core/auth/types/audit-service.types';
import { ONE_HUNDRED } from '@/constants/numbers';

/**
 * AuditRepository class for handling audit data operations.
 */
export class AuditRepository {
  private static instance: AuditRepository;
  private dbService?: DatabaseService;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   * @returns AuditRepository instance.
   */
  public static getInstance(): AuditRepository {
    AuditRepository.instance ||= new AuditRepository();
    return AuditRepository.instance;
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
   * Insert an audit event into the database.
   * @param userId - Optional user ID.
   * @param action - Action that was performed.
   * @param resource - Optional resource identifier.
   * @param success - Whether the action was successful.
   * @param errorMessage - Optional error message if failed.
   * @param metadata - Optional metadata JSON string.
   * @param ipAddress - Optional IP address.
   * @param userAgent - Optional user agent.
   * @returns Promise that resolves when inserted.
   */
  async insertAuditEvent(
    userId: string | null,
    action: string,
    resource: string | null,
    success: boolean,
    errorMessage: string | null,
    metadata: string | null,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<void> {
    const id = randomUUID();
    const db = await this.getDatabase();
    await db.execute(
      `INSERT INTO auth_audit_log (id, user_id, action, resource, success, error_message, metadata, ip_address, user_agent, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, userId, action, resource, success ? 1 : 0, errorMessage, metadata, ipAddress, userAgent],
    );
  }

  /**
   * Get audit events with optional filtering.
   * @param userId - Optional user ID filter.
   * @param limit - Maximum number of events to return.
   * @returns Array of audit events.
   */
  async getAuditEvents(userId?: string, limit = ONE_HUNDRED): Promise<IAuditRow[]> {
    let query = 'SELECT * FROM auth_audit_log';
    const params: string[] = [];

    if (userId !== undefined) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(String(limit));

    const db = await this.getDatabase();
    return await db.query<IAuditRow>(query, params);
  }
}
