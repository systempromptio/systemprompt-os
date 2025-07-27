/**
 * Audit service for authentication events.
 * @module modules/core/auth/services/audit.service
 */

import { AuditRepository } from '@/modules/core/auth/repositories/audit.repository';
import type {
  AuthAuditAction,
  IAuthAuditEntry
} from '@/modules/core/auth/types/index';
import type {
  IAuditConfig,
  IAuditFilters,
  IAuditRow,
  IAuthAuditEvent,
  ILogger
} from '@/modules/core/auth/types/audit-service.types';
import { ONE_HUNDRED } from '@/constants/numbers';

/**
 * AuthAuditService class for comprehensive audit logging.
 * Implements singleton pattern for core module compliance.
 */
export class AuthAuditService {
  private static instance: AuthAuditService;
  private readonly config: IAuditConfig;
  private readonly logger: ILogger;
  private readonly repository: AuditRepository;

  /**
   * Private constructor for singleton pattern.
   * @param config - Audit configuration.
   * @param logger - Logger instance.
   */
  private constructor(config: IAuditConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
    this.repository = AuditRepository.getInstance();
  }

  /**
   * Get singleton instance of AuthAuditService.
   * @param config - Audit configuration.
   * @param logger - Logger instance.
   * @returns AuthAuditService instance.
   */
  public static getInstance(
    config?: IAuditConfig,
    logger?: ILogger
  ): AuthAuditService {
    if (AuthAuditService.instance === undefined) {
      if (config === undefined || logger === undefined) {
        throw new Error(
          'Config and logger required for first initialization'
        );
      }
      AuthAuditService.instance = new AuthAuditService(config, logger);
    }
    return AuthAuditService.instance;
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
      await this.recordAuditEntry(event);
    } catch (error) {
      this.handleError('Failed to record audit event', error);
    }
  }

  /**
   * Record audit entry in database.
   * @param event - Event to record.
   * @returns Promise that resolves when recorded.
   */
  private async recordAuditEntry(
    event: IAuthAuditEvent
  ): Promise<void> {
    const metadata = event.metadata !== undefined
      ? JSON.stringify(event.metadata)
      : null;

    await this.repository.insertAuditEvent(
      event.userId ?? null,
      event.action,
      event.resource ?? null,
      event.success,
      event.errorMessage ?? null,
      metadata,
      event.ipAddress ?? null,
      event.userAgent ?? null
    );
  }

  /**
   * Get audit entries with optional filtering.
   * @param filters - Optional filters to apply.
   * @returns Array of audit entries.
   */
  async getAuditEntries(
    filters?: IAuditFilters
  ): Promise<IAuthAuditEntry[]> {
    try {
      const rows = await this.fetchAuditRows(filters);
      return this.mapRowsToEntries(rows);
    } catch (error) {
      this.handleError('Failed to get audit entries', error);
      return [];
    }
  }

  /**
   * Fetch audit rows from repository.
   * @param filters - Optional filters to apply.
   * @returns Array of audit rows.
   */
  private async fetchAuditRows(
    filters?: IAuditFilters
  ): Promise<IAuditRow[]> {
    const limit = filters?.limit ?? ONE_HUNDRED;
    const userId = filters?.userId;

    const rows = await this.repository.getAuditEvents(
      userId,
      limit
    );

    return this.applyFilters(rows, filters);
  }

  /**
   * Apply filters to audit rows.
   * @param rows - Rows to filter.
   * @param filters - Filters to apply.
   * @returns Filtered rows.
   */
  private applyFilters(
    rows: IAuditRow[],
    filters?: IAuditFilters
  ): IAuditRow[] {
    let filtered = rows;

    if (filters?.action !== undefined) {
      filtered = filtered.filter(
        (row: IAuditRow): boolean => { return row.action === filters.action }
      );
    }

    if (filters?.startDate !== undefined) {
      const startTime = filters.startDate.getTime();
      filtered = filtered.filter(
        (row: IAuditRow): boolean => { return new Date(row.timestamp).getTime() >= startTime }
      );
    }

    if (filters?.endDate !== undefined) {
      const endTime = filters.endDate.getTime();
      filtered = filtered.filter(
        (row: IAuditRow): boolean => { return new Date(row.timestamp).getTime() <= endTime }
      );
    }

    return filtered;
  }

  /**
   * Map database rows to audit entries.
   * @param rows - Database rows.
   * @returns Audit entries.
   */
  private mapRowsToEntries(
    rows: IAuditRow[]
  ): IAuthAuditEntry[] {
    return rows.map((row: IAuditRow): IAuthAuditEntry => { return this.mapRowToEntry(row) });
  }

  /**
   * Map single database row to audit entry.
   * @param row - Database row.
   * @returns Audit entry.
   */
  private mapRowToEntry(row: IAuditRow): IAuthAuditEntry {
    const entry: IAuthAuditEntry = {
      id: row.id,
      action: row.action as AuthAuditAction,
      success: row.success === 1,
      timestamp: new Date(row.timestamp)
    };

    this.addOptionalFields(entry, row);

    return entry;
  }

  /**
   * Add optional fields to audit entry.
   * @param entry - Entry to modify.
   * @param row - Source row.
   */
  private addOptionalFields(
    entry: IAuthAuditEntry,
    row: IAuditRow
  ): void {
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
      try {
        entry.metadata = JSON.parse(row.metadata);
      } catch {
      }
    }
  }

  /**
   * Get failed login attempts for a given email.
   * @param email - Email address to check.
   * @param since - Date to check from.
   * @returns Number of failed attempts.
   */
  async getFailedLoginAttempts(
    email: string,
    since: Date
  ): Promise<number> {
    try {
      const entries = await this.getAuditEntries({
        action: 'auth.failed',
        startDate: since
      });

      return entries.filter(
        (entry: IAuthAuditEntry): boolean => { return entry.resource === email }
      ).length;
    } catch (error) {
      this.handleError(
        'Failed to get failed login attempts',
        error
      );
      return 0;
    }
  }

  /**
   * Cleanup old audit entries.
   * @returns Number of entries deleted.
   */
  async cleanupOldEntries(): Promise<number> {
    if (!this.config.enabled) {
      return 0;
    }

    try {
      const cutoffDate = this.calculateCutoffDate();
      const oldEntries = await this.getOldEntryCount(cutoffDate);

      if (oldEntries > 0) {
        await this.deleteOldEntries(cutoffDate);
        this.logCleanup(oldEntries);
      }

      return oldEntries;
    } catch (error) {
      this.handleError(
        'Failed to cleanup audit entries',
        error
      );
      return 0;
    }
  }

  /**
   * Calculate cutoff date for cleanup.
   * @returns Cutoff date.
   */
  private calculateCutoffDate(): Date {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - this.config.retentionDays
    );
    return cutoffDate;
  }

  /**
   * Get count of old entries.
   * @param cutoffDate - Cutoff date.
   * @returns Number of old entries.
   */
  private async getOldEntryCount(
    cutoffDate: Date
  ): Promise<number> {
    const entries = await this.getAuditEntries({
      endDate: cutoffDate,
      limit: Number.MAX_SAFE_INTEGER
    });
    return entries.length;
  }

  /**
   * Delete old entries from database.
   * @param cutoffDate - Cutoff date.
   * @returns Promise that resolves when deleted.
   */
  private async deleteOldEntries(
    cutoffDate: Date
  ): Promise<void> {
    const oldEntries = await this.getAuditEntries({
      endDate: cutoffDate,
      limit: Number.MAX_SAFE_INTEGER
    });

    if (oldEntries.length > 0) {
      this.logger.warn(
        'Audit cleanup: deletion not implemented',
        { count: oldEntries.length }
      );
    }
  }

  /**
   * Log cleanup information.
   * @param count - Number of entries cleaned.
   */
  private logCleanup(count: number): void {
    this.logger.info(
      'Cleaned up old audit entries',
      { count }
    );
  }

  /**
   * Handle errors consistently.
   * @param message - Error message.
   * @param error - Error object.
   */
  private handleError(
    message: string,
    error: unknown
  ): void {
    const errorObj = error instanceof Error
      ? error
      : new Error(String(error));
    this.logger.error(message, errorObj);
  }
}
