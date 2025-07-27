/**
 * Type definitions for the audit service.
 * @module modules/core/auth/types/audit-service.types
 */

import type { AuthAuditAction } from '@/modules/core/auth/types/index';

/**
 * Configuration interface for AuthAuditService.
 */
export interface IAuditConfig {
    enabled: boolean;
    retentionDays: number;
}

/**
 * Logger interface expected by AuthAuditService.
 */
export interface ILogger {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, error?: Error) => void;
}

/**
 * Audit event interface for AuthAuditService.
 */
export interface IAuthAuditEvent {
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
 * Filter interface for getAuditEntries.
 */
export interface IAuditFilters {
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
}

/**
 * Database row interface for auth_audit table.
 */
export interface IAuditRow {
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
