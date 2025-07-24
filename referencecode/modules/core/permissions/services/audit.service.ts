/**
 * Permission audit service
 */

import { DatabaseService } from '../../database/services/database.service.js';
import type { PermissionAuditEntry, AuditAction } from '../types/index.js';
import type { Logger } from '../../../types.js';

export class AuditService {
  private readonly db: DatabaseService;

  constructor(private readonly logger: Logger) {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Record audit entry
   */
  async recordAudit(entry: Omit<PermissionAuditEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      await this.db.execute(
        `
        INSERT INTO permission_audit 
        (user_id, target_type, target_id, action, resource, permission_action, details, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          entry.userId || null,
          entry.targetType,
          entry.targetId,
          entry.action,
          entry.resource || null,
          entry.permissionAction || null,
          entry.details ? JSON.stringify(entry.details) : null,
          new Date().toISOString(),
        ],
      );

      this.logger.debug('Audit entry recorded', { action: entry.action, targetId: entry.targetId });
    } catch (error) {
      // Don't throw on audit failures - just log
      this.logger.error('Failed to record audit entry', { entry, error });
    }
  }

  /**
   * Get audit entries
   */
  async getAuditEntries(filters?: {
    userId?: string;
    targetId?: string;
    targetType?: 'user' | 'role';
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<PermissionAuditEntry[]> {
    try {
      let sql = 'SELECT * FROM permission_audit WHERE 1=1';
      const params: any[] = [];

      if (filters?.userId) {
        sql += ' AND user_id = ?';
        params.push(filters.userId);
      }

      if (filters?.targetId) {
        sql += ' AND target_id = ?';
        params.push(filters.targetId);
      }

      if (filters?.targetType) {
        sql += ' AND target_type = ?';
        params.push(filters.targetType);
      }

      if (filters?.action) {
        sql += ' AND action = ?';
        params.push(filters.action);
      }

      if (filters?.startDate) {
        sql += ' AND timestamp >= ?';
        params.push(filters.startDate.toISOString());
      }

      if (filters?.endDate) {
        sql += ' AND timestamp <= ?';
        params.push(filters.endDate.toISOString());
      }

      sql += ' ORDER BY timestamp DESC';

      if (filters?.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
      }

      const rows = await this.db.query<any>(sql, params);

      return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        targetType: row.target_type as 'user' | 'role',
        targetId: row.target_id,
        action: row.action as AuditAction,
        resource: row.resource,
        permissionAction: row.permission_action,
        details: row.details ? JSON.parse(row.details) : undefined,
        timestamp: new Date(row.timestamp),
      }));
    } catch (error) {
      this.logger.error('Failed to get audit entries', { filters, error });
      throw new Error('Failed to get audit entries');
    }
  }

  /**
   * Clean up old audit entries
   */
  async cleanupOldEntries(retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.db.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM permission_audit WHERE timestamp < ?',
        [cutoffDate.toISOString()],
      );

      const count = result[0]?.count || 0;

      if (count > 0) {
        await this.db.execute('DELETE FROM permission_audit WHERE timestamp < ?', [
          cutoffDate.toISOString(),
        ]);

        this.logger.info('Cleaned up old audit entries', { count, retentionDays });
      }

      return count;
    } catch (error) {
      this.logger.error('Failed to cleanup audit entries', { retentionDays, error });
      throw error;
    }
  }
}
