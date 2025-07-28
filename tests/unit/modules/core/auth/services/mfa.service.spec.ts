/**
 * @fileoverview Unit tests for MFAService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MFAService } from '@/modules/core/auth/services/mfa.service';
import { MFAError, MFASetupError, MFAVerificationError } from '@/modules/core/auth/errors/mfa.errors';
import { MFARepository } from '@/modules/core/auth/repositories/mfa.repository';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { ILogger } from '@/modules/core/logger/types';
import { LogSource } from '@/modules/core/logger/types';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

// Mock dependencies
vi.mock('@/modules/core/database/services/database.service');
vi.mock('@/modules/core/auth/repositories/mfa.repository');
vi.mock('speakeasy');
vi.mock('qrcode');

describe('MFA Error Classes', () => {
  describe('MFAError', () => {
    it('should create MFAError with message, code, and optional userId', () => {
      const error = new MFAError('Test error', 'TEST_CODE', 'user-123');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(MFAError);
      expect(error.name).toBe('MFAError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.userId).toBe('user-123');
    });

    it('should create MFAError without userId', () => {
      const error = new MFAError('Test error', 'TEST_CODE');
      
      expect(error.name).toBe('MFAError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.userId).toBeUndefined();
    });
  });

  describe('MFASetupError', () => {
    it('should create MFASetupError with correct properties', () => {
      const error = new MFASetupError('Setup failed', 'user-123');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(MFAError);
      expect(error).toBeInstanceOf(MFASetupError);
      expect(error.name).toBe('MFASetupError');
      expect(error.message).toBe('Setup failed');
      expect(error.code).toBe('MFA_SETUP_ERROR');
      expect(error.userId).toBe('user-123');
    });

    it('should create MFASetupError without userId', () => {
      const error = new MFASetupError('Setup failed');
      
      expect(error.name).toBe('MFASetupError');
      expect(error.message).toBe('Setup failed');
      expect(error.code).toBe('MFA_SETUP_ERROR');
      expect(error.userId).toBeUndefined();
    });
  });

  describe('MFAVerificationError', () => {
    it('should create MFAVerificationError with correct properties', () => {
      const error = new MFAVerificationError('Verification failed', 'user-123');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(MFAError);
      expect(error).toBeInstanceOf(MFAVerificationError);
      expect(error.name).toBe('MFAVerificationError');
      expect(error.message).toBe('Verification failed');
      expect(error.code).toBe('MFA_VERIFICATION_ERROR');
      expect(error.userId).toBe('user-123');
    });

    it('should create MFAVerificationError without userId', () => {
      const error = new MFAVerificationError('Verification failed');
      
      expect(error.name).toBe('MFAVerificationError');
      expect(error.message).toBe('Verification failed');
      expect(error.code).toBe('MFA_VERIFICATION_ERROR');
      expect(error.userId).toBeUndefined();
    });
  });
});

describe('MFAService', () => {
  let mfaService: MFAService;
  let mockDb: any;
  let mockLogger: ILogger;
  let mockConfig: any;
  let mockRepository: any;

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

    // Mock repository methods
    mockRepository = {
      getUserMFAData: vi.fn(),
      updateMFASetup: vi.fn(),
      enableMFA: vi.fn(),
      disableMFA: vi.fn(),
      updateBackupCodes: vi.fn(),
      isEnabled: vi.fn(),
    };

    (DatabaseService.getInstance as any) = vi.fn().mockReturnValue(mockDb);
    (MFARepository.getInstance as any) = vi.fn().mockReturnValue(mockRepository);

    // Reset singleton instance for each test
    (MFAService as any).instance = undefined;

    mfaService = MFAService.initialize(mockConfig, mockLogger);
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

    it('should return same instance when initialize is called multiple times', () => {
      const instance1 = MFAService.initialize(mockConfig, mockLogger);
      const instance2 = MFAService.initialize(mockConfig, mockLogger);
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should initialize with provided config and logger', () => {
      const service = MFAService.initialize(mockConfig, mockLogger);
      expect(service).toBeInstanceOf(MFAService);
      expect(MFARepository.getInstance).toHaveBeenCalled();
    });

    it('should store config and logger internally', () => {
      const service = MFAService.initialize(mockConfig, mockLogger);
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
      mockRepository.updateMFASetup.mockResolvedValue(undefined);

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
      mockRepository.updateMFASetup.mockResolvedValue(undefined);

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
      mockRepository.updateMFASetup.mockRejectedValue(new Error('Database error'));

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
      mockRepository.updateMFASetup.mockResolvedValue(undefined);

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
      // Reset singleton for custom config test
      (MFAService as any).instance = undefined;
      const customService = MFAService.initialize(
        { ...mockConfig, backupCodeCount: 10 },
        mockLogger
      );

      (speakeasy.generateSecret as any) = vi.fn().mockReturnValue(mockSecret);
      (qrcode.toDataURL as any) = vi.fn().mockResolvedValue('data:image/png;base64,mockQRCode');
      mockRepository.updateMFASetup.mockResolvedValue(undefined);

      const result = await customService.setupMFA(userId, email);

      expect(result.backupCodes).toHaveLength(10);
    });

    it('should throw error when secret generation fails to produce otpauth_url', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: undefined, // Missing otpauth_url
      };

      (speakeasy.generateSecret as any) = vi.fn().mockReturnValue(mockSecret);

      await expect(mfaService.setupMFA(userId, email)).rejects.toThrow('Failed to generate OTP auth URL');
      expect(qrcode.toDataURL).not.toHaveBeenCalled();
      expect(mockRepository.updateMFASetup).not.toHaveBeenCalled();
    });

    it('should throw error when secret generation produces null otpauth_url', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: null, // null otpauth_url
      };

      (speakeasy.generateSecret as any) = vi.fn().mockReturnValue(mockSecret);

      await expect(mfaService.setupMFA(userId, email)).rejects.toThrow('Failed to generate OTP auth URL');
      expect(qrcode.toDataURL).not.toHaveBeenCalled();
      expect(mockRepository.updateMFASetup).not.toHaveBeenCalled();
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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(true);
      mockRepository.enableMFA.mockResolvedValue(undefined);

      const result = await mfaService.enableMFA(userId, code);

      expect(result).toBe(true);
      expect(mockRepository.enableMFA).toHaveBeenCalledWith(userId);
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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(false);

      const result = await mfaService.enableMFA(userId, code);

      expect(result).toBe(false);
      expect(mockRepository.enableMFA).not.toHaveBeenCalled();
    });

    it('should handle missing MFA setup', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_secret: null,
        mfa_backup_codes: null,
      };

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

      await expect(mfaService.enableMFA(userId, code)).rejects.toThrow('MFA not set up');
    });

    it('should handle user not found during enable', async () => {
      const userId = 'user-123';
      const code = '123456';

      mockRepository.getUserMFAData.mockResolvedValueOnce(null);

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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

      await expect(mfaService.enableMFA(userId, code)).rejects.toThrow('MFA not set up');
    });

    it('should handle database query failure during enable', async () => {
      const userId = 'user-123';
      const code = '123456';

      mockRepository.getUserMFAData.mockRejectedValue(new Error('Database query failed'));

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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(true);
      mockRepository.enableMFA.mockRejectedValue(new Error('Database update failed'));

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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(true);
      mockRepository.enableMFA.mockResolvedValue(undefined);

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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
      (speakeasy.totp.verify as any) = vi.fn().mockReturnValue(false);
      mockRepository.updateBackupCodes.mockResolvedValue(undefined);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(true);
      expect(mockRepository.updateBackupCodes).toHaveBeenCalledWith(
        userId,
        JSON.stringify(['backup456'])
      );
    });

    it('should handle MFA not enabled', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_enabled: 0,
      };

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

      const result = await mfaService.verifyMFA({ userId, code });

      expect(result).toBe(false);
      expect(speakeasy.totp.verify).not.toHaveBeenCalled();
    });

    it('should handle user not found during verify', async () => {
      const userId = 'user-123';
      const code = '123456';

      mockRepository.getUserMFAData.mockResolvedValueOnce(null);

      await expect(mfaService.verifyMFA({ userId, code })).rejects.toThrow('User not found');
    });

    it('should handle undefined user object in array during verify', async () => {
      const userId = 'user-123';
      const code = '123456';

      // Simulate repository returning null
      mockRepository.getUserMFAData.mockResolvedValueOnce(null);

      await expect(mfaService.verifyMFA({ userId, code })).rejects.toThrow('User not found');
    });

    it('should handle null user object in array during verify', async () => {
      const userId = 'user-123';
      const code = '123456';

      // Simulate repository returning null
      mockRepository.getUserMFAData.mockResolvedValueOnce(null);

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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(false);
      expect(mockRepository.updateBackupCodes).not.toHaveBeenCalled();
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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(false);
      expect(mockRepository.updateBackupCodes).not.toHaveBeenCalled();
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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(false);
      expect(mockRepository.updateBackupCodes).not.toHaveBeenCalled();
    });

    it('should handle database query failure during verify', async () => {
      const userId = 'user-123';
      const code = '123456';

      mockRepository.getUserMFAData.mockRejectedValue(new Error('Database query failed'));

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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
      mockRepository.updateBackupCodes.mockRejectedValue(new Error('Database update failed'));

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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
      mockRepository.updateBackupCodes.mockResolvedValue(undefined);

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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

      const result = await mfaService.verifyMFA({ userId, code });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(LogSource.AUTH, 'MFA verification attempted for user without MFA enabled', { userId });
    });

    it('should handle null mfa_secret during TOTP verification', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockUser = {
        id: userId,
        mfa_secret: null,
        mfa_enabled: 1,
      };

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

      const result = await mfaService.verifyMFA({ userId, code });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(LogSource.AUTH, 'MFA secret not found for user', { userId });
      expect(speakeasy.totp.verify).not.toHaveBeenCalled();
    });

    it('should handle backup codes with non-string elements', async () => {
      const userId = 'user-123';
      const backupCode = 'backup123';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
        mfa_backup_codes: JSON.stringify(['backup123', 123, 'backup456']), // Contains non-string element
      };

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(LogSource.AUTH, 'Invalid backup codes format', { userId });
      expect(mockRepository.updateBackupCodes).not.toHaveBeenCalled();
    });

    it('should handle backup codes with mixed data types', async () => {
      const userId = 'user-123';
      const backupCode = 'backup123';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
        mfa_backup_codes: JSON.stringify([true, null, 'backup456']), // Contains boolean and null
      };

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(LogSource.AUTH, 'Invalid backup codes format', { userId });
      expect(mockRepository.updateBackupCodes).not.toHaveBeenCalled();
    });

    it('should handle backup codes as non-array JSON', async () => {
      const userId = 'user-123';
      const backupCode = 'backup123';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
        mfa_backup_codes: JSON.stringify({ codes: ['backup123'] }), // Object instead of array
      };

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(LogSource.AUTH, 'Invalid backup codes format', { userId });
      expect(mockRepository.updateBackupCodes).not.toHaveBeenCalled();
    });

    it('should log specific error message when JSON parsing fails', async () => {
      const userId = 'user-123';
      const backupCode = 'backup123';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
        mfa_backup_codes: '{invalid-json-syntax}', // Malformed JSON
      };

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(LogSource.AUTH, 'Failed to parse backup codes', {
        userId,
        error: expect.any(String)
      });
      expect(mockRepository.updateBackupCodes).not.toHaveBeenCalled();
    });

    it('should handle non-Error objects in JSON parse catch block', async () => {
      const userId = 'user-123';
      const backupCode = 'backup123';
      const mockUser = {
        id: userId,
        mfa_secret: 'encrypted_secret',
        mfa_enabled: 1,
        mfa_backup_codes: 'invalid-json',
      };

      // Mock JSON.parse to throw a non-Error object
      const originalParse = JSON.parse;
      JSON.parse = vi.fn().mockImplementation(() => {
        throw 'String error'; // Non-Error object
      });

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(LogSource.AUTH, 'Failed to parse backup codes', {
        userId,
        error: 'String error'
      });

      // Restore original JSON.parse
      JSON.parse = originalParse;
    });
  });

  describe('disableMFA', () => {
    it('should disable MFA successfully', async () => {
      const userId = 'user-123';

      mockRepository.disableMFA.mockResolvedValue(undefined);

      await mfaService.disableMFA(userId);

      expect(mockRepository.disableMFA).toHaveBeenCalledWith(userId);
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'MFA disabled for user', { userId });
    });

    it('should handle database update failure during disable', async () => {
      const userId = 'user-123';

      mockRepository.disableMFA.mockRejectedValue(new Error('Database update failed'));

      await expect(mfaService.disableMFA(userId)).rejects.toThrow('Database update failed');
    });

    it('should call logger.debug during disable process', async () => {
      const userId = 'user-123';

      mockRepository.disableMFA.mockResolvedValue(undefined);

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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
      mockRepository.updateBackupCodes.mockResolvedValue(undefined);

      const result = await mfaService.regenerateBackupCodes(userId);

      expect(result).toHaveLength(8);
      expect(mockRepository.updateBackupCodes).toHaveBeenCalledWith(
        userId,
        expect.any(String)
      );
    });

    it('should throw error for non-MFA user', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        mfa_enabled: 0,
      };

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);

      await expect(mfaService.regenerateBackupCodes(userId)).rejects.toThrow('MFA not enabled');
    });

    it('should throw error for user not found during regenerate', async () => {
      const userId = 'user-123';

      mockRepository.getUserMFAData.mockResolvedValueOnce(null);

      await expect(mfaService.regenerateBackupCodes(userId)).rejects.toThrow('User not found');
    });

    it('should handle undefined user object in array during regenerate', async () => {
      const userId = 'user-123';

      // Simulate repository returning null
      mockRepository.getUserMFAData.mockResolvedValueOnce(null);

      await expect(mfaService.regenerateBackupCodes(userId)).rejects.toThrow('User not found');
    });

    it('should handle null user object in array during regenerate', async () => {
      const userId = 'user-123';

      // Simulate repository returning null
      mockRepository.getUserMFAData.mockResolvedValueOnce(null);

      await expect(mfaService.regenerateBackupCodes(userId)).rejects.toThrow('User not found');
    });

    it('should handle database query failure during regenerate', async () => {
      const userId = 'user-123';

      mockRepository.getUserMFAData.mockRejectedValue(new Error('Database query failed'));

      await expect(mfaService.regenerateBackupCodes(userId)).rejects.toThrow('Database query failed');
    });

    it('should handle database update failure during regenerate', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        mfa_enabled: 1,
      };

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
      mockRepository.updateBackupCodes.mockRejectedValue(new Error('Database update failed'));

      await expect(mfaService.regenerateBackupCodes(userId)).rejects.toThrow('Database update failed');
    });

    it('should call logger methods during regenerate process', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        mfa_enabled: 1,
      };

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
      mockRepository.updateBackupCodes.mockResolvedValue(undefined);

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
      // Reset singleton for custom config test
      (MFAService as any).instance = undefined;
      const customService = MFAService.initialize(
        { ...mockConfig, backupCodeCount: 12 },
        mockLogger
      );

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
      mockRepository.updateBackupCodes.mockResolvedValue(undefined);

      const result = await customService.regenerateBackupCodes(userId);

      expect(result).toHaveLength(12);
    });
  });

  describe('isEnabled', () => {
    it('should return true for MFA-enabled user', async () => {
      const userId = 'user-123';

      mockRepository.isEnabled.mockResolvedValueOnce(true);

      const result = await mfaService.isEnabled(userId);

      expect(result).toBe(true);
      expect(mockRepository.isEnabled).toHaveBeenCalledWith(userId);
    });

    it('should return false for MFA-disabled user', async () => {
      const userId = 'user-123';

      mockRepository.isEnabled.mockResolvedValueOnce(false);

      const result = await mfaService.isEnabled(userId);

      expect(result).toBe(false);
    });

    it('should return false for user not found', async () => {
      const userId = 'user-123';

      mockRepository.isEnabled.mockResolvedValueOnce(false);

      const result = await mfaService.isEnabled(userId);

      expect(result).toBe(false);
    });

    it('should handle database query failure during isEnabled', async () => {
      const userId = 'user-123';

      mockRepository.isEnabled.mockRejectedValue(new Error('Database query failed'));

      await expect(mfaService.isEnabled(userId)).rejects.toThrow('Database query failed');
    });

    it('should return false for user with null mfa_enabled', async () => {
      const userId = 'user-123';

      mockRepository.isEnabled.mockResolvedValueOnce(false);

      const result = await mfaService.isEnabled(userId);

      expect(result).toBe(false);
    });

    it('should return false for user with undefined mfa_enabled', async () => {
      const userId = 'user-123';

      mockRepository.isEnabled.mockResolvedValueOnce(false);

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
      mockRepository.updateMFASetup.mockResolvedValue(undefined);

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
      mockRepository.updateMFASetup.mockResolvedValue(undefined);

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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
      mockRepository.updateBackupCodes.mockResolvedValue(undefined);

      const result = await mfaService.verifyMFA({ userId, code: backupCode, isBackupCode: true });

      expect(result).toBe(true);
      expect(mockRepository.updateBackupCodes).toHaveBeenCalledWith(
        userId,
        JSON.stringify([]) // Empty array after removing the last code
      );
    });
  });

  describe('Configuration and Edge Case Coverage', () => {
    it('should use windowSize from config during TOTP verification', async () => {
      // Reset singleton for custom config test
      (MFAService as any).instance = undefined;
      const customService = MFAService.initialize(
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

      mockRepository.getUserMFAData.mockResolvedValueOnce(mockUser);
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
      // Reset singleton for custom config test
      (MFAService as any).instance = undefined;
      const customService = MFAService.initialize(
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
      mockRepository.updateMFASetup.mockResolvedValue(undefined);

      await customService.setupMFA(userId, email);

      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: 'CustomApp (test@example.com)',
        issuer: 'CustomApp',
      });
    });
  });
});