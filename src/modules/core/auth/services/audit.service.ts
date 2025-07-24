/**
 *  *  * @file Audit service for authentication events.
 * @module modules/core/auth/services/audit.service
 */

import type { DatabaseService } from '@/modules/core/database/services/database.service.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { ZERO, ONE, TWO, THREE, FOUR, FIVE, TEN, TWENTY, THIRTY, FORTY, FIFTY, SIXTY, EIGHTY, ONE_HUNDRED } from '../constants';

const ONE_HUNDRED = 100;

const ZERO = ZERO;
const ONE = ONE;

/**
 *  *
 * AuditEvent interface

 */

export interface IAuditEvent {
  userId?: string;
  action: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 *  *
 * AuditService class.

 */

export class AuditService {
  private static instance: AuditService;

  /**
 *  * Get singleton instance
   */
  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
 *  * Private constructor for singleton
   */
  private constructor() {
    // Initialize
  }



  async logEvent(event: AuditEvent): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO auth_audit_log (userId, action, details, ip_address, user_agent, createdAt)
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
      this.(logger as any).error('Failed to log audit event', {
 event,
error
});
    }
  }

  async getEvents(userId?: string, limit = ONE_HUNDRED): Promise<AuditEvent[]> {
    try {
      let query = 'SELECT * FROM auth_audit_log';
      const params: string[] = [];

      if (userId !== undefined && userId !== null) {
        query += ' WHERE userId = ?';
        params.push(userId);
      }

      query += ' ORDER BY createdAt DESC LIMIT ?';
      params.push(String(limit));

      const rows = await this.db.query<any>(query, params);

      return rows.map((row) : void => { return {
        userId: row.userId,
        action: row.action,
        details: row.details ? JSON.parse(row.details) : undefined,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
      } });
    } catch (error) {
      this.(logger as any).error('Failed to get audit events', {
 userId,
error
});
      return [];
    }
  }
}
