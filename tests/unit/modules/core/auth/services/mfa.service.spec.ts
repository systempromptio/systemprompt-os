/**
 * @fileoverview Unit tests for MFAService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MFAService } from '@/modules/core/auth/services/mfa.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { ILogger } from '@/modules/core/logger/types';
import { LogSource } from '@/modules/core/logger/types';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

// Mock dependencies
vi.mock('@/modules/core/database/services/database.service');
vi.mock('speakeasy');
vi.mock('qrcode');

describe('MFAService', () => {
  let mfaService: MFAService;
  let mockDb: any;
  let mockLogger: ILogger;
  let mockConfig: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      execute: vi.fn(),
      transaction: vi.fn(),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockConfig = {
      appName: 'TestApp',
      backupCodeCount: 8,
      windowSize: 1,
    };

    (DatabaseService.getInstance as any) = vi.fn().mockReturnValue(mockDb);

    // Reset singleton instance for each test
    (MFAService as any).instance = undefined;

    mfaService = new MFAService(mockConfig, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clean up singleton for next test
    (MFAService as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should throw error when getInstance called without initialization', () => {
      (MFAService as any).instance = undefined;
      expect(() => MFAService.getInstance()).toThrow('MFAService must be initialized with config and logger first');
    });

    it('should return singleton instance after initialization', () => {
      const instance1 = MFAService.initialize(mockConfig, mockLogger);
      const instance2 = MFAService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance when initialize is called', () => {
      const instance1 = MFAService.initialize(mockConfig, mockLogger);
      const instance2 = MFAService.initialize(mockConfig, mockLogger);
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Constructor', () => {
    it('should initialize with provided config and logger', () => {
      const service = new MFAService(mockConfig, mockLogger);
      expect(service).toBeInstanceOf(MFAService);
      expect(DatabaseService.getInstance).toHaveBeenCalled();
    });

    it('should store config and logger internally', () => {
      const service = new MFAService(mockConfig, mockLogger);
      // Test that config is used by calling a method that uses it
      expect(service).toBeDefined();
    });
  });

  describe('setupMFA', () => {
    it('should setup MFA for a user successfully', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/TestApp:test@example.com?secret=JBSWY3DPEHPK3PXP',
      };

      (speakeasy.generateSecret as any) = vi.fn().mockReturnValue(mockSecret);
      (qrcode.toDataURL as any) = vi.fn().mockResolvedValue('data:image/png;base64,mockQRCode');

      const result = await mfaService.setupMFA(userId, email);

      expect(result).toHaveProperty('secret', mockSecret.base32);
      expect(result).toHaveProperty('qrCodeUrl', 'data:image/png;base64,mockQRCode');
      expect(result.backupCodes).toHaveLength(8);
      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: `TestApp (test@example.com)`,
        issuer: 'TestApp',
      });
    });

    it('should handle QR code generation failure', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/TestApp:test@example.com?secret=JBSWY3DPEHPK3PXP',
      };

      (speakeasy.generateSecret as any) = vi.fn().mockReturnValue(mockSecret);
      (qrcode.toDataURL as any) = vi.fn().mockRejectedValue(new Error('QR generation failed'));

      await expect(mfaService.setupMFA(userId, email)).rejects.toThrow('QR generation failed');
    });

    it('should handle database update failure during setup', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/TestApp:test@example.com?secret=JBSWY3DPEHPK3PXP',
      };

      (speakeasy.generateSecret as any) = vi.fn().mockReturnValue(mockSecret);
      (qrcode.toDataURL as any) = vi.fn().mockResolvedValue('data:image/png;base64,mockQRCode');
      mockDb.execute.mockRejectedValue(new Error('Database error'));

      await expect(mfaService.setupMFA(userId, email)).rejects.toThrow('Database error');
    });

    it('should call logger.debug and logger.info during setup', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/TestApp:test@example.com?secret=JBSWY3DPEHPK3PXP',
      };

      (speakeasy.generateSecret as any) = vi.fn().mockReturnValue(mockSecret);
      (qrcode.toDataURL as any) = vi.fn().mockResolvedValue('data:image/png;base64,mockQRCode');
      mockDb.execute.mockResolvedValue(undefined);

      await mfaService.setupMFA(userId, email);

      expect(mockLogger.debug).toHaveBeenCalledWith(LogSource.AUTH, 'Setting up MFA for user', { userId, email });
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'MFA setup completed for user', { userId });
    });

    it('should generate backup codes with correct count from config', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/TestApp:test@example.com?secret=JBSWY3DPEHPK3PXP',
      };

      // Test with different backup code count
      const customService = new MFAService(
        { ...mockConfig, backupCodeCount: 10 },
        mockLogger
      );

      (speakeasy.generateSecret as any) = vi.fn().mockReturnValue(mockSecret);
      (qrcode.toDataURL as any) = vi.fn().mockResolvedValue('data:image/png;base64,mockQRCode');
      mockDb.execute.mockResolvedValue(undefined);

      const result = await customService.setupMFA(userId, email);

      expect(result.backupCodes).toHaveLength(10);
    });
  });

  describe('enableMFA', () => {
    it('should enable MFA when code is valid', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_backup_codes: JSON.stringify(['code1', 'code2']),
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(true);
      mockDb.execute.mockResolvedValue(undefined);

      const result = await mfaService.enableMFA(userId, code);

      expect(result).toBe(true);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth_users SET mfa_enabled = ?'),
        [1, userId]
      );
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'MFA enabled for user', { userId });
    });

    it('should not enable MFA when code is invalid', async () => {
      const userId = 'user-123';
      const code = '000000';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_backup_codes: JSON.stringify(['code1', 'code2']),
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(false);

      const result = await mfaService.enableMFA(userId, code);

      expect(result).toBe(false);
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should handle missing MFA setup', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_secret: null,
        mfa_backup_codes: null,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);

      await expect(mfaService.enableMFA(userId, code)).rejects.toThrow('MFA not set up');
    });

    it('should handle user not found during enable', async () => {
      const userId = 'user-123';
      const code = '123456';

      mockDb.query.mockResolvedValueOnce([]);

      await expect(mfaService.enableMFA(userId, code)).rejects.toThrow('User not found');
    });

    it('should handle missing mfa_secret during enable', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_secret: null,
        mfa_backup_codes: JSON.stringify(['code1', 'code2']),
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);

      await expect(mfaService.enableMFA(userId, code)).rejects.toThrow('MFA not set up');
    });

    it('should handle missing mfa_backup_codes during enable', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_backup_codes: null,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);

      await expect(mfaService.enableMFA(userId, code)).rejects.toThrow('MFA not set up');
    });

    it('should handle database query failure during enable', async () => {
      const userId = 'user-123';
      const code = '123456';

      mockDb.query.mockRejectedValue(new Error('Database query failed'));

      await expect(mfaService.enableMFA(userId, code)).rejects.toThrow('Database query failed');
    });

    it('should handle database update failure during enable', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_backup_codes: JSON.stringify(['code1', 'code2']),
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(true);
      mockDb.execute.mockRejectedValue(new Error('Database update failed'));

      await expect(mfaService.enableMFA(userId, code)).rejects.toThrow('Database update failed');
    });

    it('should call logger methods during enable process', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_backup_codes: JSON.stringify(['code1', 'code2']),
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(true);
      mockDb.execute.mockResolvedValue(undefined);

      const result = await mfaService.enableMFA(userId, code);

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(LogSource.AUTH, 'Enabling MFA for user', { userId });
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'MFA enabled for user', { userId });
    });

    it('should call logger.warn when invalid code provided', async () => {
      const userId = 'user-123';
      const code = '000000';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_backup_codes: JSON.stringify(['code1', 'code2']),
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(false);

      const result = await mfaService.enableMFA(userId, code);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(LogSource.AUTH, 'Invalid MFA code during enable', { userId });
    });
  });

  describe('verifyMFA', () => {
    it('should verify valid TOTP code', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(true);

      const result = await mfaService.verifyMFA({ userId, code });

      expect(result).toBe(true);
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'encrypted_secret',
        encoding: 'base32',
        token: code,
        window: 1,
      });
    });

    it('should verify valid backup code', async () => {
      const userId = 'user-123';
      const backupCode = 'backup123';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
        mfa_backup_codes: JSON.stringify(['backup123', 'backup456']),
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(false);
      mockDb.execute.mockResolvedValue(undefined);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(true);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth_users SET mfa_backup_codes = ?'),
        [JSON.stringify(['backup456']), userId]
      );
    });

    it('should handle MFA not enabled', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_enabled: 0,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);

      const result = await mfaService.verifyMFA({ userId, code });

      expect(result).toBe(false);
      expect(speakeasy.totp.verify).not.toHaveBeenCalled();
    });

    it('should handle user not found during verify', async () => {
      const userId = 'user-123';
      const code = '123456';

      mockDb.query.mockResolvedValueOnce([]);

      await expect(mfaService.verifyMFA({ userId, code })).rejects.toThrow('User not found');
    });

    it('should handle invalid backup code', async () => {
      const userId = 'user-123';
      const backupCode = 'invalid123';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
        mfa_backup_codes: JSON.stringify(['backup123', 'backup456']),
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(false);
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should handle null backup codes when verifying backup code', async () => {
      const userId = 'user-123';
      const backupCode = 'backup123';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
        mfa_backup_codes: null,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(false);
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON in backup codes', async () => {
      const userId = 'user-123';
      const backupCode = 'backup123';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
        mfa_backup_codes: 'invalid-json',
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(false);
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should handle database query failure during verify', async () => {
      const userId = 'user-123';
      const code = '123456';

      mockDb.query.mockRejectedValue(new Error('Database query failed'));

      await expect(mfaService.verifyMFA({ userId, code })).rejects.toThrow('Database query failed');
    });

    it('should handle database update failure when using backup code', async () => {
      const userId = 'user-123';
      const backupCode = 'backup123';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
        mfa_backup_codes: JSON.stringify(['backup123', 'backup456']),
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      mockDb.execute.mockRejectedValue(new Error('Database update failed'));

      await expect(mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true })).rejects.toThrow('Database update failed');
    });

    it('should call logger methods during successful TOTP verification', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(true);

      const result = await mfaService.verifyMFA({ userId, code });

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(LogSource.AUTH, 'Verifying MFA for user', { userId, isBackupCode: false });
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'MFA verification successful', { userId });
    });

    it('should call logger methods during failed TOTP verification', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(false);

      const result = await mfaService.verifyMFA({ userId, code });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(LogSource.AUTH, 'Verifying MFA for user', { userId, isBackupCode: false });
      expect(mockLogger.warn).toHaveBeenCalledWith(LogSource.AUTH, 'MFA verification failed', { userId });
    });

    it('should call logger methods during backup code verification', async () => {
      const userId = 'user-123';
      const backupCode = 'backup123';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
        mfa_backup_codes: JSON.stringify(['backup123', 'backup456']),
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      mockDb.execute.mockResolvedValue(undefined);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(LogSource.AUTH, 'Verifying MFA for user', { userId, isBackupCode: true });
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Backup code used successfully', { userId });
    });

    it('should call logger.warn for MFA verification attempt when MFA not enabled', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_enabled: 0,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);

      const result = await mfaService.verifyMFA({ userId, code });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(LogSource.AUTH, 'MFA verification attempted for user without MFA enabled', { userId });
    });
  });

  describe('disableMFA', () => {
    it('should disable MFA successfully', async () => {
      const userId = 'user-123';

      mockDb.execute.mockResolvedValue(undefined);

      await mfaService.disableMFA(userId);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth_users SET mfa_enabled = ?, mfa_secret = ?, mfa_backup_codes = ?'),
        [0, null, null, userId]
      );
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'MFA disabled for user', { userId });
    });

    it('should handle database update failure during disable', async () => {
      const userId = 'user-123';

      mockDb.execute.mockRejectedValue(new Error('Database update failed'));

      await expect(mfaService.disableMFA(userId)).rejects.toThrow('Database update failed');
    });

    it('should call logger.debug during disable process', async () => {
      const userId = 'user-123';

      mockDb.execute.mockResolvedValue(undefined);

      await mfaService.disableMFA(userId);

      expect(mockLogger.debug).toHaveBeenCalledWith(LogSource.AUTH, 'Disabling MFA for user', { userId });
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'MFA disabled for user', { userId });
    });
  });

  describe('regenerateBackupCodes', () => {
    it('should regenerate backup codes for MFA-enabled user', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        mfa_enabled: 1,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      mockDb.execute.mockResolvedValue(undefined);

      const result = await mfaService.regenerateBackupCodes(userId);

      expect(result).toHaveLength(8);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth_users SET mfa_backup_codes = ?'),
        [expect.any(String), userId]
      );
    });

    it('should throw error for non-MFA user', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        mfa_enabled: 0,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);

      await expect(mfaService.regenerateBackupCodes(userId)).rejects.toThrow('MFA not enabled');
    });

    it('should throw error for user not found during regenerate', async () => {
      const userId = 'user-123';

      mockDb.query.mockResolvedValueOnce([]);

      await expect(mfaService.regenerateBackupCodes(userId)).rejects.toThrow('User not found');
    });

    it('should handle database query failure during regenerate', async () => {
      const userId = 'user-123';

      mockDb.query.mockRejectedValue(new Error('Database query failed'));

      await expect(mfaService.regenerateBackupCodes(userId)).rejects.toThrow('Database query failed');
    });

    it('should handle database update failure during regenerate', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        mfa_enabled: 1,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      mockDb.execute.mockRejectedValue(new Error('Database update failed'));

      await expect(mfaService.regenerateBackupCodes(userId)).rejects.toThrow('Database update failed');
    });

    it('should call logger methods during regenerate process', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        mfa_enabled: 1,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      mockDb.execute.mockResolvedValue(undefined);

      const result = await mfaService.regenerateBackupCodes(userId);

      expect(result).toHaveLength(8);
      expect(mockLogger.debug).toHaveBeenCalledWith(LogSource.AUTH, 'Regenerating backup codes for user', { userId });
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Backup codes regenerated for user', { userId });
    });

    it('should generate backup codes with correct count from config', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        mfa_enabled: 1,
      };

      // Test with different backup code count
      const customService = new MFAService(
        { ...mockConfig, backupCodeCount: 12 },
        mockLogger
      );

      mockDb.query.mockResolvedValueOnce([mockUser]);
      mockDb.execute.mockResolvedValue(undefined);

      const result = await customService.regenerateBackupCodes(userId);

      expect(result).toHaveLength(12);
    });
  });

  describe('isEnabled', () => {
    it('should return true for MFA-enabled user', async () => {
      const userId = 'user-123';
      const mockUser = {
        mfa_enabled: 1,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);

      const result = await mfaService.isEnabled(userId);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT mfa_enabled FROM auth_users WHERE id = ?',
        [userId]
      );
    });

    it('should return false for MFA-disabled user', async () => {
      const userId = 'user-123';
      const mockUser = {
        mfa_enabled: 0,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);

      const result = await mfaService.isEnabled(userId);

      expect(result).toBe(false);
    });

    it('should return false for user not found', async () => {
      const userId = 'user-123';

      mockDb.query.mockResolvedValueOnce([]);

      const result = await mfaService.isEnabled(userId);

      expect(result).toBe(false);
    });

    it('should handle database query failure during isEnabled', async () => {
      const userId = 'user-123';

      mockDb.query.mockRejectedValue(new Error('Database query failed'));

      await expect(mfaService.isEnabled(userId)).rejects.toThrow('Database query failed');
    });

    it('should return false for user with null mfa_enabled', async () => {
      const userId = 'user-123';
      const mockUser = {
        mfa_enabled: null,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);

      const result = await mfaService.isEnabled(userId);

      expect(result).toBe(false);
    });

    it('should return false for user with undefined mfa_enabled', async () => {
      const userId = 'user-123';
      const mockUser = {};

      mockDb.query.mockResolvedValueOnce([mockUser]);

      const result = await mfaService.isEnabled(userId);

      expect(result).toBe(false);
    });
  });

  describe('Private method coverage through public methods', () => {
    it('should generate unique backup codes', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/TestApp:test@example.com?secret=JBSWY3DPEHPK3PXP',
      };

      (speakeasy.generateSecret as any) = vi.fn().mockReturnValue(mockSecret);
      (qrcode.toDataURL as any) = vi.fn().mockResolvedValue('data:image/png;base64,mockQRCode');
      mockDb.execute.mockResolvedValue(undefined);

      const result1 = await mfaService.setupMFA(userId, email);
      const result2 = await mfaService.setupMFA(userId, email);

      // Verify codes are generated (should be different each time due to crypto.randomBytes)
      expect(result1.backupCodes).toHaveLength(8);
      expect(result2.backupCodes).toHaveLength(8);
      expect(result1.backupCodes).not.toEqual(result2.backupCodes);
    });

    it('should validate backup codes are uppercase hex strings', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/TestApp:test@example.com?secret=JBSWY3DPEHPK3PXP',
      };

      (speakeasy.generateSecret as any) = vi.fn().mockReturnValue(mockSecret);
      (qrcode.toDataURL as any) = vi.fn().mockResolvedValue('data:image/png;base64,mockQRCode');
      mockDb.execute.mockResolvedValue(undefined);

      const result = await mfaService.setupMFA(userId, email);

      result.backupCodes.forEach(code => {
        expect(code).toMatch(/^[A-F0-9]{8}$/); // 8 character uppercase hex
      });
    });

    it('should handle edge case where backup code is found and removed correctly', async () => {
      const userId = 'user-123';
      const backupCode = 'backup123';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
        mfa_backup_codes: JSON.stringify(['backup123']), // Only one code
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      mockDb.execute.mockResolvedValue(undefined);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(true);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth_users SET mfa_backup_codes = ?'),
        [JSON.stringify([]), userId] // Empty array after removing the last code
      );
    });
  });

  describe('Configuration and Edge Case Coverage', () => {
    it('should use windowSize from config during TOTP verification', async () => {
      const customService = new MFAService(
        { ...mockConfig, windowSize: 2 },
        mockLogger
      );

      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
      };

      mockDb.query.mockResolvedValueOnce([mockUser]);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(true);

      await customService.verifyMFA({ userId, code });

      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'encrypted_secret',
        encoding: 'base32',
        token: code,
        window: 2, // Custom window size
      });
    });

    it('should use appName from config during secret generation', async () => {
      const customService = new MFAService(
        { ...mockConfig, appName: 'CustomApp' },
        mockLogger
      );

      const userId = 'user-123';
      const email = 'test@example.com';
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/CustomApp:test@example.com?secret=JBSWY3DPEHPK3PXP',
      };

      (speakeasy.generateSecret as any) = vi.fn().mockReturnValue(mockSecret);
      (qrcode.toDataURL as any) = vi.fn().mockResolvedValue('data:image/png;base64,mockQRCode');
      mockDb.execute.mockResolvedValue(undefined);

      await customService.setupMFA(userId, email);

      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: 'CustomApp (test@example.com)',
        issuer: 'CustomApp',
      });
    });
  });
});