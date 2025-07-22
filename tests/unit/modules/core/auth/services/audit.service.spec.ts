/**
 * @fileoverview Unit tests for AuthAuditService
 */

import { AuthAuditService } from '@/modules/core/auth/services/audit.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { Logger } from '@/modules/types';
import type { AuthAuditAction } from '@/modules/core/auth/types';

// Mock dependencies
jest.mock('@/modules/core/database/services/database.service');

describe('AuthAuditService', () => {
  let auditService: AuthAuditService;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      execute: jest.fn(),
      transaction: jest.fn(),
    } as any;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);

    auditService = new AuthAuditService(
      {
        enabled: true,
        retentionDays: 90,
      },
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordEvent', () => {
    it('should record an audit event when enabled', async () => {
      const event = {
        action: 'auth.login' as AuthAuditAction,
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        metadata: { extra: 'data' },
      };

      mockDb.execute.mockResolvedValue(undefined);

      await auditService.recordEvent(event);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_audit'),
        expect.arrayContaining([
          expect.any(String), // id
          'user-123',
          'auth.login',
          null, // resource
          '192.168.1.1',
          'Mozilla/5.0',
          1, // success
          null, // error_message
          JSON.stringify({ extra: 'data' }),
        ])
      );
    });

    it('should not record when disabled', async () => {
      auditService = new AuthAuditService(
        {
          enabled: false,
          retentionDays: 90,
        },
        mockLogger
      );

      const event = {
        action: 'auth.login' as AuthAuditAction,
        success: true,
      };

      await auditService.recordEvent(event);

      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const event = {
        action: 'auth.login' as AuthAuditAction,
        success: true,
      };

      mockDb.execute.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await auditService.recordEvent(event);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to record audit event',
        expect.any(Error)
      );
    });
  });

  describe('getAuditEntries', () => {
    it('should retrieve audit entries with filters', async () => {
      const filters = {
        userId: 'user-123',
        action: 'auth.login',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        limit: 50,
      };

      const mockEntries = [
        {
          id: 'audit-1',
          user_id: 'user-123',
          action: 'auth.login',
          resource: null,
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          success: 1,
          error_message: null,
          metadata: JSON.stringify({ device: 'desktop' }),
          timestamp: '2024-01-15T10:00:00Z',
        },
        {
          id: 'audit-2',
          user_id: 'user-123',
          action: 'auth.login',
          resource: null,
          ip_address: '192.168.1.2',
          user_agent: 'Chrome/96',
          success: 0,
          error_message: 'Invalid credentials',
          metadata: null,
          timestamp: '2024-01-16T11:00:00Z',
        },
      ];

      mockDb.query.mockResolvedValueOnce(mockEntries);

      const result = await auditService.getAuditEntries(filters);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'audit-1',
        userId: 'user-123',
        action: 'auth.login',
        success: true,
        metadata: { device: 'desktop' },
      });
      expect(result[1]).toMatchObject({
        id: 'audit-2',
        userId: 'user-123',
        action: 'auth.login',
        success: false,
        errorMessage: 'Invalid credentials',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE 1=1'),
        ['user-123', 'auth.login', filters.startDate, filters.endDate, 50]
      );
    });

    it('should handle entries without filters', async () => {
      const mockEntries = [{
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

      mockDb.query.mockResolvedValueOnce(mockEntries);

      const result = await auditService.getAuditEntries();

      expect(result[0]).toMatchObject({
        id: 'audit-1',
        userId: undefined,
        action: 'auth.failed',
        resource: 'test@example.com',
        success: false,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY timestamp DESC'),
        [100] // default limit
      );
    });
  });

  describe('getFailedLoginAttempts', () => {
    it('should count failed login attempts', async () => {
      const email = 'test@example.com';
      const since = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago

      mockDb.query.mockResolvedValueOnce([{ count: 3 }]);

      const result = await auditService.getFailedLoginAttempts(email, since);

      expect(result).toBe(3);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as count'),
        ['auth.failed', email, since]
      );
    });

    it('should return 0 when no attempts found', async () => {
      const email = 'test@example.com';
      const since = new Date();

      mockDb.query.mockResolvedValueOnce([]);

      const result = await auditService.getFailedLoginAttempts(email, since);

      expect(result).toBe(0);
    });
  });

  describe('cleanupOldEntries', () => {
    it('should cleanup old entries when enabled', async () => {
      mockDb.execute.mockResolvedValue({ rowsAffected: 100 } as any);

      const result = await auditService.cleanupOldEntries();

      expect(result).toBe(100);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM auth_audit WHERE timestamp < ?'),
        expect.arrayContaining([expect.any(Date)])
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaned up old audit entries', { count: 100 });
    });

    it('should not cleanup when disabled', async () => {
      auditService = new AuthAuditService(
        {
          enabled: false,
          retentionDays: 90,
        },
        mockLogger
      );

      const result = await auditService.cleanupOldEntries();

      expect(result).toBe(0);
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors', async () => {
      mockDb.execute.mockRejectedValue(new Error('Database error'));

      const result = await auditService.cleanupOldEntries();

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to cleanup audit entries',
        expect.any(Error)
      );
    });
  });
});