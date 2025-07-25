/**
 * Audit service for authentication events.
 * @module modules/core/auth/services/audit.service
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { ONE_HUNDRED } from '@/const/numbers.js';

/**
 * AuditEvent interface.
 */
export interface IAuditEvent {
  userId?: string;
  action: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * AuditService class.
 */
export class AuditService {
  private static instance: AuditService;
  private readonly logger!: ILogger;
  private readonly db!: DatabaseService;

  /**
   * Get singleton instance.
   * @returns AuditService instance.
   */
  public static getInstance(): AuditService {
    AuditService.instance ||= new AuditService();
    return AuditService.instance;
  }

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    this.logger = LoggerService.getInstance();
    this.db = DatabaseService.getInstance();
  }

  /**
   * Log an audit event.
   * @param event - Event to log.
   * @returns Promise that resolves when logged.
   */
  async logEvent(event: IAuditEvent): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO auth_audit_log (userId, action, details, ip_address, user_agent, createdAt)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          event.userId ?? null,
          event.action,
          event.details ? JSON.stringify(event.details) : null,
          event.ipAddress ?? null,
          event.userAgent ?? null,
        ],
      );

      this.logger.debug('Audit event logged', {
        action: event.action,
        userId: event.userId
      });
    } catch (error) {
      this.logger.error('Failed to log audit event', {
        event,
        error
      });
    }
  }

  /**
   * Get audit events.
   * @param userId - Optional user ID filter.
   * @param limit - Maximum number of events.
   * @returns Array of audit events.
   */
  async getEvents(userId?: string, limit = ONE_HUNDRED): Promise<IAuditEvent[]> {
    try {
      let query = 'SELECT * FROM auth_audit_log';
      const params: string[] = [];

      if (userId !== undefined && userId !== null) {
        query += ' WHERE userId = ?';
        params.push(userId);
      }

      query += ' ORDER BY createdAt DESC LIMIT ?';
      params.push(String(limit));

      interface IAuditRow {
        userId: string;
        action: string;
        details: string | null;
        ip_address: string | null;
        user_agent: string | null;
      }

      const rows = await this.db.query<IAuditRow>(query, params);

      return rows.map((row): IAuditEvent => {
        const event: IAuditEvent = {
          action: row.action,
        };
        if (row.userId) { event.userId = row.userId; }
        if (row.details) { event.details = JSON.parse(row.details); }
        if (row.ip_address) { event.ipAddress = row.ip_address; }
        if (row.user_agent) { event.userAgent = row.user_agent; }
        return event;
      });
    } catch (error) {
      this.logger.error('Failed to get audit events', {
        userId,
        error
      });
      return [];
    }
  }
}
