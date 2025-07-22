/**
 * Authentication audit service
 */

import type { AuthAuditEntry, AuthAuditAction } from '../types/index.js';
import type { Logger } from '@/modules/types';
import { DatabaseService } from '@/modules/core/database/services/database.service';

export class AuthAuditService {
  private db: DatabaseService;
  
  constructor(
    private config: {
      enabled: boolean;
      retentionDays: number;
    },
    private logger: Logger
  ) {
    this.db = DatabaseService.getInstance();
  }
  
  /**
   * Record audit entry
   */
  async recordAudit(entry: Omit<AuthAuditEntry, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    
    try {
      const id = this.generateId();
      
      await this.db.execute(`
        INSERT INTO auth_audit_log 
        (id, user_id, action, resource, ip_address, user_agent, success, error_message, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        id,
        entry.userId || null,
        entry.action,
        entry.resource || null,
        entry.ipAddress || null,
        entry.userAgent || null,
        entry.success ? 1 : 0,
        entry.errorMessage || null,
        entry.metadata ? JSON.stringify(entry.metadata) : null
      ]);
      
      this.logger.debug('Audit entry recorded', { action: entry.action, userId: entry.userId });
    } catch (error) {
      // Don't throw on audit failures - just log
      this.logger.error('Failed to record audit entry', { entry, error });
    }
  }
  
  /**
   * Record successful login
   */
  async recordLogin(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.recordAudit({
      userId,
      action: 'auth.login',
      ipAddress,
      userAgent,
      success: true,
      metadata
    });
  }
  
  /**
   * Record failed login
   */
  async recordFailedLogin(
    email: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.recordAudit({
      action: 'auth.failed',
      resource: email,
      ipAddress,
      userAgent,
      success: false,
      errorMessage: reason
    });
  }
  
  /**
   * Record logout
   */
  async recordLogout(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.recordAudit({
      userId,
      action: 'auth.logout',
      ipAddress,
      userAgent,
      success: true
    });
  }
  
  /**
   * Record MFA event
   */
  async recordMFAEvent(
    userId: string,
    action: 'mfa.enable' | 'mfa.disable' | 'mfa.verify' | 'mfa.failed',
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorMessage?: string
  ): Promise<void> {
    await this.recordAudit({
      userId,
      action,
      ipAddress,
      userAgent,
      success,
      errorMessage
    });
  }
  
  /**
   * Record token event
   */
  async recordTokenEvent(
    userId: string,
    action: 'token.create' | 'token.revoke' | 'token.use',
    tokenType: string,
    tokenId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.recordAudit({
      userId,
      action,
      resource: tokenId,
      ipAddress,
      userAgent,
      success: true,
      metadata: { tokenType }
    });
  }
  
  /**
   * Get audit entries
   */
  async getAuditEntries(filters?: {
    userId?: string;
    action?: AuthAuditAction;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
    limit?: number;
  }): Promise<AuthAuditEntry[]> {
    try {
      let sql = 'SELECT * FROM auth_audit_log WHERE 1=1';
      const params: any[] = [];
      
      if (filters?.userId) {
        sql += ' AND user_id = ?';
        params.push(filters.userId);
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
      
      if (filters?.success !== undefined) {
        sql += ' AND success = ?';
        params.push(filters.success ? 1 : 0);
      }
      
      sql += ' ORDER BY timestamp DESC';
      
      if (filters?.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
      }
      
      const rows = await this.db.query<any>(sql, params);
      
      return rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        action: row.action as AuthAuditAction,
        resource: row.resource,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        success: Boolean(row.success),
        errorMessage: row.error_message,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        timestamp: new Date(row.timestamp)
      }));
    } catch (error) {
      this.logger.error('Failed to get audit entries', { filters, error });
      throw new Error('Failed to get audit entries');
    }
  }
  
  /**
   * Get failed login attempts
   */
  async getFailedLoginAttempts(
    email: string,
    since: Date
  ): Promise<number> {
    try {
      const result = await this.db.query<{ count: number }>(`
        SELECT COUNT(*) as count 
        FROM auth_audit_log 
        WHERE action = 'auth.failed' 
          AND resource = ? 
          AND timestamp >= ?
          AND success = 0
      `, [email, since.toISOString()]);
      
      return result[0]?.count || 0;
    } catch (error) {
      this.logger.error('Failed to get failed login attempts', { email, error });
      return 0;
    }
  }
  
  /**
   * Clean up old audit entries
   */
  async cleanupOldEntries(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      
      const result = await this.db.query<{ count: number }>(`
        SELECT COUNT(*) as count 
        FROM auth_audit_log 
        WHERE timestamp < ?
      `, [cutoffDate.toISOString()]);
      
      const count = result[0]?.count || 0;
      
      if (count > 0) {
        await this.db.execute(`
          DELETE FROM auth_audit_log 
          WHERE timestamp < ?
        `, [cutoffDate.toISOString()]);
        
        this.logger.info('Cleaned up old audit entries', { count, retentionDays: this.config.retentionDays });
      }
      
      return count;
    } catch (error) {
      this.logger.error('Failed to cleanup audit entries', { error });
      throw error;
    }
  }
  
  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}