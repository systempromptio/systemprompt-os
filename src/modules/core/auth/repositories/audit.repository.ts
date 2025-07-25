/**
 * Audit repository for authentication events data access.
 * @module modules/core/auth/repositories/audit.repository
 */

import { randomUUID } from 'node:crypto';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IAuditRow } from '@/modules/core/auth/types/index';
import { ONE_HUNDRED } from '@/const/numbers';

/**
 * AuditRepository class for handling audit data operations.
 */
export class AuditRepository {
  private static instance: AuditRepository;

  /**
   * Private constructor for singleton pattern.
   * @param db - Database service instance.
   */
  private constructor(private readonly db: DatabaseService) {}

  /**
   * Get singleton instance.
   * @returns AuditRepository instance.
   */
  public static getInstance(): AuditRepository {
    AuditRepository.instance ||= new AuditRepository(DatabaseService.getInstance());
    return AuditRepository.instance;
  }

  /**
   * Insert an audit event into the database.
   * @param userId - Optional user ID.
   * @param action - Action that was performed.
   * @param details - Optional event details.
   * @param ipAddress - Optional IP address.
   * @param userAgent - Optional user agent.
   * @returns Promise that resolves when inserted.
   */
  async insertAuditEvent(
    userId: string | null,
    action: string,
    details: string | null,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<void> {
    const id = randomUUID();
    await this.db.execute(
      `INSERT INTO auth_audit_log (id, userId, action, details, ip_address, user_agent, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [id, userId, action, details, ipAddress, userAgent],
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
      query += ' WHERE userId = ?';
      params.push(userId);
    }

    query += ' ORDER BY createdAt DESC LIMIT ?';
    params.push(String(limit));

    return await this.db.query<IAuditRow>(query, params);
  }
}