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
  /**
   * Constructor for AuditRepository.
   * @param database - Database service instance.
   */
  constructor(private readonly database: DatabaseService) {}

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
    await this.database.execute(
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

    return await this.database.query<IAuditRow>(query, params);
  }
}
