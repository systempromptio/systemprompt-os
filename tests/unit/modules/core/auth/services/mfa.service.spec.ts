/**
 * @fileoverview Unit tests for MFAService
 */

import { MFAService } from '@/modules/core/auth/services/mfa.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { Logger } from '@/modules/types';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

// Mock dependencies
jest.mock('@/modules/core/database/services/database.service');
jest.mock('speakeasy');
jest.mock('qrcode');

describe('MFAService', () => {
  let mfaService: MFAService;
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

    mfaService = new MFAService(
      {
        appName: 'TestApp',
        backupCodeCount: 8,
        windowSize: 1,
      },
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setupMFA', () => {
    it('should setup MFA for a user successfully', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/TestApp:test@example.com?secret=JBSWY3DPEHPK3PXP',
      };

      (speakeasy.generateSecret as jest.Mock).mockReturnValue(mockSecret);
      (qrcode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,mockQRCode');

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

      (speakeasy.generateSecret as jest.Mock).mockReturnValue(mockSecret);
      (qrcode.toDataURL as jest.Mock).mockRejectedValue(new Error('QR generation failed'));

      await expect(mfaService.setupMFA(userId, email)).rejects.toThrow('QR generation failed');
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
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
      mockDb.execute.mockResolvedValue(undefined);

      const result = await mfaService.enableMFA(userId, code);

      expect(result).toBe(true);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth_users SET mfa_enabled = ?'),
        [1, userId]
      );
      expect(mockLogger.info).toHaveBeenCalledWith('MFA enabled for user', { userId });
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
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

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
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

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
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);
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
      expect(mockLogger.info).toHaveBeenCalledWith('MFA disabled for user', { userId });
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
  });
});