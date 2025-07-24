/**
 * @file Audit service for authentication events.
 * @module modules/core/auth/services/audit.service
 */

import type { DatabaseService } from '@/modules/core/database/services/database.service.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';

export interface AuditEvent {
  userId?: string;
  action: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  constructor(
    private readonly db: DatabaseService,
    private readonly logger: ILogger,
  ) {}

  async logEvent(event: AuditEvent): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO auth_audit_log (user_id, action, details, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          event.userId || null,
          event.action,
          event.details ? JSON.stringify(event.details) : null,
          event.ipAddress || null,
          event.userAgent || null,
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

  async getEvents(userId?: string, limit = 100): Promise<AuditEvent[]> {
    try {
      let query = 'SELECT * FROM auth_audit_log';
      const params: string[] = [];

      if (userId) {
        query += ' WHERE user_id = ?';
        params.push(userId);
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(String(limit));

      const rows = await this.db.query<any>(query, params);

      return rows.map((row) => { return {
        userId: row.user_id,
        action: row.action,
        details: row.details ? JSON.parse(row.details) : undefined,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
      } });
    } catch (error) {
      this.logger.error('Failed to get audit events', {
 userId,
error
});
      return [];
    }
  }
}
