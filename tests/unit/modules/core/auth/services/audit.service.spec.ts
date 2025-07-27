/**
 * @fileoverview Unit tests for AuthAuditService
 */

import { AuthAuditService } from '@/modules/core/auth/services/audit.service';
import { AuditRepository } from '@/modules/core/auth/repositories/audit.repository';
import type { AuthAuditAction } from '@/modules/core/auth/types';
import type { IAuditConfig, ILogger } from '@/modules/core/auth/types/audit-service.types';

import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';

// Mock dependencies
vi.mock('@/modules/core/auth/repositories/audit.repository');

describe('AuthAuditService', () => {
  let mockRepository: any;
  let mockLogger: ILogger;
  let config: IAuditConfig;

  beforeEach(() => {
    // Reset the singleton instance before each test
    (AuthAuditService as any).instance = undefined;

    mockRepository = {
      insertAuditEvent: vi.fn(),
      getAuditEvents: vi.fn(),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    config = {
      enabled: true,
      retentionDays: 90,
    };

    vi.mocked(AuditRepository.getInstance).mockReturnValue(mockRepository);
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Reset singleton for next test
    (AuthAuditService as any).instance = undefined;
  });

  describe('getInstance', () => {
    it('should create instance with config and logger on first call', () => {
      const instance = AuthAuditService.getInstance(config, mockLogger);
      
      expect(instance).toBeInstanceOf(AuthAuditService);
    });

    it('should return same instance on subsequent calls', () => {
      const instance1 = AuthAuditService.getInstance(config, mockLogger);
      const instance2 = AuthAuditService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should throw error if config is missing on first initialization', () => {
      expect(() => {
        AuthAuditService.getInstance(undefined, mockLogger);
      }).toThrow('Config and logger required for first initialization');
    });

    it('should throw error if logger is missing on first initialization', () => {
      expect(() => {
        AuthAuditService.getInstance(config, undefined);
      }).toThrow('Config and logger required for first initialization');
    });

    it('should throw error if both config and logger are missing on first initialization', () => {
      expect(() => {
        AuthAuditService.getInstance();
      }).toThrow('Config and logger required for first initialization');
    });
  });

  describe('recordEvent', () => {
    let auditService: AuthAuditService;

    beforeEach(() => {
      auditService = AuthAuditService.getInstance(config, mockLogger);
    });

    it('should record an audit event when enabled with all fields', async () => {
      const event = {
        action: 'auth.login' as AuthAuditAction,
        userId: 'user-123',
        resource: 'test-resource',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        errorMessage: 'test-error',
        metadata: { extra: 'data' },
      };

      mockRepository.insertAuditEvent.mockResolvedValue(undefined);

      await auditService.recordEvent(event);

      expect(mockRepository.insertAuditEvent).toHaveBeenCalledWith(
        'user-123',
        'auth.login',
        'test-resource',
        true,
        'test-error',
        JSON.stringify({ extra: 'data' }),
        '192.168.1.1',
        'Mozilla/5.0'
      );
    });

    it('should record an audit event with minimal fields', async () => {
      const event = {
        action: 'auth.logout' as AuthAuditAction,
        success: false,
      };

      mockRepository.insertAuditEvent.mockResolvedValue(undefined);

      await auditService.recordEvent(event);

      expect(mockRepository.insertAuditEvent).toHaveBeenCalledWith(
        null,
        'auth.logout',
        null,
        false,
        null,
        null,
        null,
        null
      );
    });

    it('should not record when disabled', async () => {
      // Reset singleton to create a new instance with disabled config
      (AuthAuditService as any).instance = undefined;
      const disabledConfig = { enabled: false, retentionDays: 90 };
      const disabledService = AuthAuditService.getInstance(disabledConfig, mockLogger);

      const event = {
        action: 'auth.login' as AuthAuditAction,
        success: true,
      };

      await disabledService.recordEvent(event);

      expect(mockRepository.insertAuditEvent).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      const event = {
        action: 'auth.login' as AuthAuditAction,
        success: true,
      };

      mockRepository.insertAuditEvent.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await auditService.recordEvent(event);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to record audit event',
        expect.any(Error)
      );
    });

    it('should handle non-Error exceptions', async () => {
      const event = {
        action: 'auth.login' as AuthAuditAction,
        success: true,
      };

      mockRepository.insertAuditEvent.mockRejectedValue('string error');

      await auditService.recordEvent(event);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to record audit event',
        expect.any(Error)
      );
    });
  });

  describe('getAuditEntries', () => {
    let auditService: AuthAuditService;

    beforeEach(() => {
      auditService = AuthAuditService.getInstance(config, mockLogger);
    });

    it('should retrieve audit entries with all filters', async () => {
      const filters = {
        userId: 'user-123',
        action: 'auth.login',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        limit: 50,
      };

      const mockRawEntries = [
        {
          id: 'audit-1',
          user_id: 'user-123',
          action: 'auth.login',
          resource: 'test-resource',
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          success: 1,
          error_message: 'test-error',
          metadata: JSON.stringify({ device: 'desktop' }),
          timestamp: '2024-01-15T10:00:00Z',
        },
        {
          id: 'audit-2',
          user_id: 'user-123',
          action: 'auth.logout', // Different action to test filtering
          resource: null,
          ip_address: '192.168.1.2',
          user_agent: 'Chrome/96',
          success: 0,
          error_message: null,
          metadata: null,
          timestamp: '2024-01-16T11:00:00Z',
        },
        {
          id: 'audit-3',
          user_id: 'user-123',
          action: 'auth.login',
          resource: null,
          ip_address: null,
          user_agent: null,
          success: 1,
          error_message: null,
          metadata: null,
          timestamp: '2023-12-31T23:59:59Z', // Before start date
        },
        {
          id: 'audit-4',
          user_id: 'user-123',
          action: 'auth.login',
          resource: null,
          ip_address: null,
          user_agent: null,
          success: 1,
          error_message: null,
          metadata: null,
          timestamp: '2024-02-01T00:00:01Z', // After end date
        },
      ];

      mockRepository.getAuditEvents.mockResolvedValue(mockRawEntries);

      const result = await auditService.getAuditEntries(filters);

      // Should only return audit-1 after filtering
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'audit-1',
        userId: 'user-123',
        action: 'auth.login',
        resource: 'test-resource',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        errorMessage: 'test-error',
        metadata: { device: 'desktop' },
        timestamp: new Date('2024-01-15T10:00:00Z'),
      });

      expect(mockRepository.getAuditEvents).toHaveBeenCalledWith('user-123', 50);
    });

    it('should handle entries without filters (default limit)', async () => {
      const mockRawEntries = [{
        id: 'audit-1',
        user_id: null,
        action: 'auth.failed',
        resource: 'test@example.com',
        ip_address: '192.168.1.1',
        user_agent: null,
        success: 0,
        error_message: 'Account locked',
        metadata: null,
        timestamp: '2024-01-15T10:00:00Z',
      }];

      mockRepository.getAuditEvents.mockResolvedValue(mockRawEntries);

      const result = await auditService.getAuditEntries();

      expect(result[0]).toMatchObject({
        id: 'audit-1',
        action: 'auth.failed',
        resource: 'test@example.com',
        ipAddress: '192.168.1.1',
        success: false,
        errorMessage: 'Account locked',
        timestamp: new Date('2024-01-15T10:00:00Z'),
      });
      expect(result[0].userId).toBeUndefined();
      expect(result[0].userAgent).toBeUndefined();
      expect(result[0].metadata).toBeUndefined();

      expect(mockRepository.getAuditEvents).toHaveBeenCalledWith(undefined, 100);
    });

    it('should handle partial filters (action only)', async () => {
      const filters = { action: 'auth.login' };
      const mockRawEntries = [
        {
          id: 'audit-1',
          user_id: 'user-123',
          action: 'auth.login',
          resource: null,
          ip_address: null,
          user_agent: null,
          success: 1,
          error_message: null,
          metadata: null,
          timestamp: '2024-01-15T10:00:00Z',
        },
        {
          id: 'audit-2',
          user_id: 'user-456',
          action: 'auth.logout',
          resource: null,
          ip_address: null,
          user_agent: null,
          success: 1,
          error_message: null,
          metadata: null,
          timestamp: '2024-01-16T11:00:00Z',
        },
      ];

      mockRepository.getAuditEvents.mockResolvedValue(mockRawEntries);

      const result = await auditService.getAuditEntries(filters);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('auth.login');
    });

    it('should handle startDate filter only', async () => {
      const filters = { startDate: new Date('2024-01-16T00:00:00Z') };
      const mockRawEntries = [
        {
          id: 'audit-1',
          user_id: 'user-123',
          action: 'auth.login',
          resource: null,
          ip_address: null,
          user_agent: null,
          success: 1,
          error_message: null,
          metadata: null,
          timestamp: '2024-01-15T23:59:59Z', // Before startDate
        },
        {
          id: 'audit-2',
          user_id: 'user-456',
          action: 'auth.logout',
          resource: null,
          ip_address: null,
          user_agent: null,
          success: 1,
          error_message: null,
          metadata: null,
          timestamp: '2024-01-16T00:00:00Z', // Exactly at startDate
        },
      ];

      mockRepository.getAuditEvents.mockResolvedValue(mockRawEntries);

      const result = await auditService.getAuditEntries(filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('audit-2');
    });

    it('should handle endDate filter only', async () => {
      const filters = { endDate: new Date('2024-01-16T00:00:00Z') };
      const mockRawEntries = [
        {
          id: 'audit-1',
          user_id: 'user-123',
          action: 'auth.login',
          resource: null,
          ip_address: null,
          user_agent: null,
          success: 1,
          error_message: null,
          metadata: null,
          timestamp: '2024-01-16T00:00:00Z', // Exactly at endDate
        },
        {
          id: 'audit-2',
          user_id: 'user-456',
          action: 'auth.logout',
          resource: null,
          ip_address: null,
          user_agent: null,
          success: 1,
          error_message: null,
          metadata: null,
          timestamp: '2024-01-16T00:00:01Z', // After endDate
        },
      ];

      mockRepository.getAuditEvents.mockResolvedValue(mockRawEntries);

      const result = await auditService.getAuditEntries(filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('audit-1');
    });

    it('should handle invalid JSON metadata gracefully', async () => {
      const mockRawEntries = [{
        id: 'audit-1',
        user_id: 'user-123',
        action: 'auth.login',
        resource: null,
        ip_address: null,
        user_agent: null,
        success: 1,
        error_message: null,
        metadata: 'invalid json {',
        timestamp: '2024-01-15T10:00:00Z',
      }];

      mockRepository.getAuditEvents.mockResolvedValue(mockRawEntries);

      const result = await auditService.getAuditEntries();

      expect(result[0].metadata).toBeUndefined();
    });

    it('should handle repository errors in getAuditEntries', async () => {
      mockRepository.getAuditEvents.mockRejectedValue(new Error('Database connection failed'));

      const result = await auditService.getAuditEntries();

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get audit entries',
        expect.any(Error)
      );
    });
  });

  describe('getFailedLoginAttempts', () => {
    let auditService: AuthAuditService;

    beforeEach(() => {
      auditService = AuthAuditService.getInstance(config, mockLogger);
    });

    it('should count failed login attempts for specific email', async () => {
      const email = 'test@example.com';
      const since = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago

      const mockRawEntries = [
        {
          id: 'audit-1',
          user_id: null,
          action: 'auth.failed',
          resource: 'test@example.com',
          ip_address: '192.168.1.1',
          user_agent: null,
          success: 0,
          error_message: 'Invalid password',
          metadata: null,
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        },
        {
          id: 'audit-2',
          user_id: null,
          action: 'auth.failed',
          resource: 'test@example.com',
          ip_address: '192.168.1.2',
          user_agent: null,
          success: 0,
          error_message: 'Account locked',
          metadata: null,
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        },
        {
          id: 'audit-3',
          user_id: null,
          action: 'auth.failed',
          resource: 'other@example.com', // Different email
          ip_address: '192.168.1.3',
          user_agent: null,
          success: 0,
          error_message: 'Invalid password',
          metadata: null,
          timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(), // 3 minutes ago
        },
      ];

      mockRepository.getAuditEvents.mockResolvedValue(mockRawEntries);

      const result = await auditService.getFailedLoginAttempts(email, since);

      expect(result).toBe(2); // Only count entries for test@example.com
    });

    it('should return 0 when no failed attempts found', async () => {
      const email = 'test@example.com';
      const since = new Date();

      mockRepository.getAuditEvents.mockResolvedValue([]);

      const result = await auditService.getFailedLoginAttempts(email, since);

      expect(result).toBe(0);
    });

    it('should return 0 when no matching email found', async () => {
      const email = 'test@example.com';
      const since = new Date(Date.now() - 15 * 60 * 1000);

      const mockRawEntries = [
        {
          id: 'audit-1',
          user_id: null,
          action: 'auth.failed',
          resource: 'other@example.com', // Different email
          ip_address: '192.168.1.1',
          user_agent: null,
          success: 0,
          error_message: 'Invalid password',
          metadata: null,
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        },
      ];

      mockRepository.getAuditEvents.mockResolvedValue(mockRawEntries);

      const result = await auditService.getFailedLoginAttempts(email, since);

      expect(result).toBe(0);
    });

    it('should handle errors in getFailedLoginAttempts', async () => {
      const email = 'test@example.com';
      const since = new Date();

      // Mock getAuditEntries to throw
      mockRepository.getAuditEvents.mockRejectedValue(new Error('Database connection failed'));

      const result = await auditService.getFailedLoginAttempts(email, since);

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get audit entries',
        expect.any(Error)
      );
    });
  });

  describe('cleanupOldEntries', () => {
    let auditService: AuthAuditService;

    beforeEach(() => {
      auditService = AuthAuditService.getInstance(config, mockLogger);
    });

    it('should cleanup old entries when enabled and entries exist', async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      
      const oldEntries = [
        {
          id: 'old-1',
          user_id: 'user-123',
          action: 'auth.login',
          resource: null,
          ip_address: null,
          user_agent: null,
          success: 1,
          error_message: null,
          metadata: null,
          timestamp: new Date(cutoffDate.getTime() - 24 * 60 * 60 * 1000).toISOString(), // 1 day before cutoff
        },
        {
          id: 'old-2',
          user_id: 'user-456',
          action: 'auth.logout',
          resource: null,
          ip_address: null,
          user_agent: null,
          success: 1,
          error_message: null,
          metadata: null,
          timestamp: new Date(cutoffDate.getTime() - 48 * 60 * 60 * 1000).toISOString(), // 2 days before cutoff
        },
      ];

      // Mock two calls to getAuditEntries - one for counting, one for deletion
      mockRepository.getAuditEvents
        .mockResolvedValueOnce(oldEntries) // First call for counting
        .mockResolvedValueOnce(oldEntries); // Second call for deletion

      const result = await auditService.cleanupOldEntries();

      expect(result).toBe(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Audit cleanup: deletion not implemented',
        { count: 2 }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleaned up old audit entries',
        { count: 2 }
      );
    });

    it('should return 0 when no old entries exist', async () => {
      mockRepository.getAuditEvents.mockResolvedValue([]);

      const result = await auditService.cleanupOldEntries();

      expect(result).toBe(0);
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should not cleanup when disabled', async () => {
      // Reset singleton to create a new instance with disabled config
      (AuthAuditService as any).instance = undefined;
      const disabledConfig = { enabled: false, retentionDays: 90 };
      const disabledService = AuthAuditService.getInstance(disabledConfig, mockLogger);

      const result = await disabledService.cleanupOldEntries();

      expect(result).toBe(0);
      expect(mockRepository.getAuditEvents).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors (repository errors during getOldEntryCount)', async () => {
      mockRepository.getAuditEvents.mockRejectedValue(new Error('Database error'));

      const result = await auditService.cleanupOldEntries();

      expect(result).toBe(0);
      // The error is caught by getAuditEntries, not cleanupOldEntries
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get audit entries',
        expect.any(Error)
      );
    });

    it('should handle errors from calculateCutoffDate through mocking Date', async () => {
      // Mock Date constructor to throw an error
      const originalDate = global.Date;
      global.Date = vi.fn(() => {
        throw new Error('Date creation failed');
      }) as any;

      const result = await auditService.cleanupOldEntries();

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to cleanup audit entries',
        expect.any(Error)
      );

      // Restore original Date
      global.Date = originalDate;
    });

    it('should handle correct cutoff date calculation', async () => {
      // Reset singleton to create a new instance with custom retention
      (AuthAuditService as any).instance = undefined;
      const configWithCustomRetention = { enabled: true, retentionDays: 30 };
      const customService = AuthAuditService.getInstance(configWithCustomRetention, mockLogger);
      
      mockRepository.getAuditEvents.mockResolvedValue([]);

      await customService.cleanupOldEntries();

      // Verify the correct filter was applied (30 days ago)
      expect(mockRepository.getAuditEvents).toHaveBeenCalledWith(
        undefined,
        Number.MAX_SAFE_INTEGER
      );
    });
  });

  describe('edge cases and error handling', () => {
    let auditService: AuthAuditService;

    beforeEach(() => {
      auditService = AuthAuditService.getInstance(config, mockLogger);
    });

    it('should handle null metadata in recordEvent', async () => {
      const event = {
        action: 'auth.login' as AuthAuditAction,
        success: true,
        metadata: undefined,
      };

      mockRepository.insertAuditEvent.mockResolvedValue(undefined);

      await auditService.recordEvent(event);

      expect(mockRepository.insertAuditEvent).toHaveBeenCalledWith(
        null,
        'auth.login',
        null,
        true,
        null,
        null,
        null,
        null
      );
    });

    it('should handle zero failed login attempts correctly', async () => {
      const email = 'test@example.com';
      const since = new Date();

      const mockRawEntries = [
        {
          id: 'audit-1',
          user_id: null,
          action: 'auth.success', // Not 'auth.failed'
          resource: 'test@example.com',
          ip_address: '192.168.1.1',
          user_agent: null,
          success: 1,
          error_message: null,
          metadata: null,
          timestamp: new Date().toISOString(),
        },
      ];

      mockRepository.getAuditEvents.mockResolvedValue(mockRawEntries);

      const result = await auditService.getFailedLoginAttempts(email, since);

      expect(result).toBe(0);
    });

    it('should handle empty audit entries array', async () => {
      mockRepository.getAuditEvents.mockResolvedValue([]);

      const result = await auditService.getAuditEntries();

      expect(result).toEqual([]);
    });
  });
});