/**
 * Audit service for authentication events.
 * @module modules/core/auth/services/audit.service
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { AuthAuditAction, IAuthAuditEntry as IAuthAuditEntryBase } from '@/modules/core/auth/types/index';

/**
 * Configuration interface for AuthAuditService.
 */
interface IAuditConfig {
  enabled: boolean;
  retentionDays: number;
}

/**
 * Logger interface expected by AuthAuditService.
 */
interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, error?: Error) => void;
}

/**
 * Audit event interface for AuthAuditService.
 */
interface IAuthAuditEvent {
  action: AuthAuditAction;
  userId?: string;
  resource?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Audit entry interface returned by getAuditEntries.
 * Extends the base interface from types.
 */
type IAuthAuditEntry = IAuthAuditEntryBase;

/**
 * Filter interface for getAuditEntries.
 */
interface IAuditFilters {
  userId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

/**
 * AuthAuditService class for comprehensive audit logging.
 */
export class AuthAuditService {
  private readonly config: IAuditConfig;
  private readonly logger: Logger;
  private readonly db: DatabaseService;

  /**
   * Constructor for AuthAuditService.
   * @param config - Audit configuration.
   * @param logger - Logger instance.
   */
  constructor(config: IAuditConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.db = DatabaseService.getInstance();
  }

  /**
   * Record an audit event.
   * @param event - Event to record.
   * @returns Promise that resolves when recorded.
   */
  async recordEvent(event: IAuthAuditEvent): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const id = this.generateId();
      await this.db.execute(
        `INSERT INTO auth_audit (id, user_id, action, resource, ip_address, user_agent, success, error_message, metadata, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          id,
          event.userId ?? null,
          event.action,
          event.resource ?? null,
          event.ipAddress ?? null,
          event.userAgent ?? null,
          event.success ? 1 : 0,
          event.errorMessage ?? null,
          event.metadata ? JSON.stringify(event.metadata) : null,
        ]
      );
    } catch (error) {
      this.logger.error('Failed to record audit event', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get audit entries with optional filtering.
   * @param filters - Optional filters to apply.
   * @returns Array of audit entries.
   */
  async getAuditEntries(filters?: IAuditFilters): Promise<IAuthAuditEntry[]> {
    try {
      let query = 'SELECT * FROM auth_audit WHERE 1=1';
      const params: any[] = [];

      if (filters?.userId) {
        query += ' AND user_id = ?';
        params.push(filters.userId);
      }

      if (filters?.action) {
        query += ' AND action = ?';
        params.push(filters.action);
      }

      if (filters?.startDate) {
        query += ' AND timestamp >= ?';
        params.push(filters.startDate);
      }

      if (filters?.endDate) {
        query += ' AND timestamp <= ?';
        params.push(filters.endDate);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(filters?.limit ?? 100);

      interface IAuditRow {
        id: string;
        user_id: string | null;
        action: string;
        resource: string | null;
        ip_address: string | null;
        user_agent: string | null;
        success: number;
        error_message: string | null;
        metadata: string | null;
        timestamp: string;
      }

      const rows = await this.db.query<IAuditRow>(query, params);

      return rows.map((row): IAuthAuditEntry => {
        const entry: IAuthAuditEntry = {
          id: row.id,
          action: row.action as AuthAuditAction,
          success: row.success === 1,
          timestamp: new Date(row.timestamp),
        };

        if (row.user_id !== null) {
          entry.userId = row.user_id;
        }
        if (row.resource !== null) {
          entry.resource = row.resource;
        }
        if (row.ip_address !== null) {
          entry.ipAddress = row.ip_address;
        }
        if (row.user_agent !== null) {
          entry.userAgent = row.user_agent;
        }
        if (row.error_message !== null) {
          entry.errorMessage = row.error_message;
        }
        if (row.metadata !== null) {
          entry.metadata = JSON.parse(row.metadata);
        }

        return entry;
      });
    } catch (error) {
      this.logger.error('Failed to get audit entries', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Get failed login attempts for a given email since a specific time.
   * @param email - Email address to check.
   * @param since - Date to check from.
   * @returns Number of failed attempts.
   */
  async getFailedLoginAttempts(email: string, since: Date): Promise<number> {
    try {
      const rows = await this.db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM auth_audit 
         WHERE action = ? AND resource = ? AND timestamp >= ?`,
        ['auth.failed', email, since]
      );

      return rows.length > 0 && rows[0] !== undefined ? rows[0].count : 0;
    } catch (error) {
      this.logger.error('Failed to get failed login attempts', error instanceof Error ? error : new Error(String(error)));
      return 0;
    }
  }

  /**
   * Cleanup old audit entries based on retention policy.
   * @returns Number of entries deleted.
   */
  async cleanupOldEntries(): Promise<number> {
    if (!this.config.enabled) {
      return 0;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      const countRows = await this.db.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM auth_audit WHERE timestamp < ?',
        [cutoffDate]
      );

      const deletedCount = countRows.length > 0 && countRows[0] !== undefined ? countRows[0].count : 0;

      await this.db.execute(
        'DELETE FROM auth_audit WHERE timestamp < ?',
        [cutoffDate]
      );

      this.logger.info('Cleaned up old audit entries', { count: deletedCount });
      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup audit entries', error instanceof Error ? error : new Error(String(error)));
      return 0;
    }
  }

  /**
   * Generate a unique ID for audit entries.
   * @returns Unique ID string.
   */
  private generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36)
.substr(2, 9)}`;
  }
}
