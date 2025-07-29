/**
 * MFA Service for managing Multi-Factor Authentication.
 * @module modules/core/auth/services/mfa.service
 */

import { type ILogger, LogSource } from '@/modules/core/logger/types';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import * as cryptoModule from 'crypto';
import { MFARepository } from '@/modules/core/auth/repositories/mfa.repository';
import type {
  IMFAConfig,
  MfaSetupResult,
  MfaVerifyInput
} from '@/modules/core/auth/types';
import {
  MFAError,
  MFASetupError,
  MFAVerificationError
} from '@/modules/core/auth/errors/mfa.errors';

/**
 * Service class for managing Multi-Factor Authentication.
 * Implements singleton pattern for core module compliance.
 */
export class MFAService {
  private static instance: MFAService | undefined;
  private readonly repository: MFARepository;
  private config!: IMFAConfig;
  private logger!: ILogger;

  /**
   * Private constructor for singleton pattern.
   * @private
   */
  private constructor() {
    this.repository = MFARepository.getInstance();
  }

  /**
   * Get singleton instance.
   * @returns MFAService instance.
   * @throws Error if service not initialized.
   */
  public static getInstance(): MFAService {
    if (MFAService.instance === undefined) {
      throw new Error('MFAService must be initialized with config and logger first');
    }
    return MFAService.instance;
  }

  /**
   * Initialize MFAService with configuration.
   * @param config - MFA configuration.
   * @param logger - Logger instance.
   * @returns Initialized MFAService instance.
   */
  public static initialize(config: IMFAConfig, logger: ILogger): MFAService {
    MFAService.instance ??= new MFAService();
    MFAService.instance.config = config;
    MFAService.instance.logger = logger;
    return MFAService.instance;
  }

  /**
   * Setup MFA for a user.
   * @param userId - User ID.
   * @param email - User email.
   * @returns MFA setup result with secret and QR code.
   * @throws MFASetupError if setup fails.
   */
  async setupMFA(userId: string, email: string): Promise<MfaSetupResult> {
    this.logger.debug(LogSource.AUTH, 'Setting up MFA for user', {
      userId,
      email
    });

    const { appName } = this.config;
    const secret = speakeasy.generateSecret({
      name: `${appName} (${email})`,
      issuer: appName,
    });

    if (typeof secret.otpauth_url !== 'string' || secret.otpauth_url.length === 0) {
      throw new MFASetupError('Failed to generate OTP auth URL', userId);
    }

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
    const backupCodes = this.generateBackupCodes();

    await this.repository.updateMFASetup(
      userId,
      secret.base32,
      JSON.stringify(backupCodes)
    );

    this.logger.info(LogSource.AUTH, 'MFA setup completed for user', { userId });

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * Enable MFA for a user after verifying the initial code.
   * @param userId - User ID.
   * @param code - TOTP code to verify.
   * @returns True if MFA was enabled successfully.
   * @throws MFASetupError if user not found or MFA not set up.
   */
  async enableMFA(userId: string, code: string): Promise<boolean> {
    this.logger.debug(LogSource.AUTH, 'Enabling MFA for user', { userId });

    const user = await this.repository.getUserMFAData(userId);

    if (user === null) {
      throw new MFASetupError('User not found', userId);
    }

    if (typeof user.mfa_secret !== 'string' || user.mfa_secret.length === 0
        || typeof user.mfa_backup_codes !== 'string' || user.mfa_backup_codes.length === 0) {
      throw new MFASetupError('MFA not set up', userId);
    }

    const { windowSize } = this.config;
    const isValid = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: code,
      window: windowSize,
    });

    if (!isValid) {
      this.logger.warn(LogSource.AUTH, 'Invalid MFA code during enable', { userId });
      return false;
    }

    await this.repository.enableMFA(userId);

    this.logger.info(LogSource.AUTH, 'MFA enabled for user', { userId });
    return true;
  }

  /**
   * Verify MFA code for a user.
   * @param params - MFA verification parameters.
   * @returns True if verification succeeds.
   * @throws MFAVerificationError if user not found.
   */
  async verifyMFA(params: MfaVerifyInput): Promise<boolean> {
    const {
      userId,
      code,
      isBackupCode = false
    } = params;
    this.logger.debug(LogSource.AUTH, 'Verifying MFA for user', {
      userId,
      isBackupCode
    });

    const user = await this.repository.getUserMFAData(userId);

    if (user === null) {
      throw new MFAVerificationError('User not found', userId);
    }

    if (user.mfa_enabled !== 1) {
      this.logger.warn(
        LogSource.AUTH,
        'MFA verification attempted for user without MFA enabled',
        { userId }
      );
      return false;
    }

    if (isBackupCode) {
      return await this.verifyBackupCode(userId, code, user.mfa_backup_codes);
    }

    return this.verifyTOTPCode(userId, code, user.mfa_secret);
  }

  /**
   * Disable MFA for a user.
   * @param userId - User ID.
   * @returns Promise resolving when MFA is disabled.
   */
  async disableMFA(userId: string): Promise<void> {
    this.logger.debug(LogSource.AUTH, 'Disabling MFA for user', { userId });

    await this.repository.disableMFA(userId);

    this.logger.info(LogSource.AUTH, 'MFA disabled for user', { userId });
  }

  /**
   * Regenerate backup codes for a user.
   * @param userId - User ID.
   * @returns New backup codes.
   * @throws MFAError if user not found or MFA not enabled.
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    this.logger.debug(LogSource.AUTH, 'Regenerating backup codes for user', { userId });

    const user = await this.repository.getUserMFAData(userId);

    if (user === null) {
      throw new MFAError('User not found', 'USER_NOT_FOUND', userId);
    }

    if (user.mfa_enabled !== 1) {
      throw new MFAError('MFA not enabled', 'MFA_NOT_ENABLED', userId);
    }

    const backupCodes = this.generateBackupCodes();

    await this.repository.updateBackupCodes(userId, JSON.stringify(backupCodes));

    this.logger.info(LogSource.AUTH, 'Backup codes regenerated for user', { userId });
    return backupCodes;
  }

  /**
   * Check if MFA is enabled for a user.
   * @param userId - User ID.
   * @returns True if MFA is enabled.
   */
  async isEnabled(userId: string): Promise<boolean> {
    return await this.repository.isEnabled(userId);
  }

  /**
   * Generate backup codes.
   * @returns Array of backup codes.
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    const { backupCodeCount } = this.config;

    for (let i = 0; i < backupCodeCount; i += 1) {
      codes.push(
        cryptoModule.randomBytes(4).toString('hex')
          .toUpperCase()
      );
    }

    return codes;
  }

  /**
   * Verify backup code and consume it.
   * @param userId - User ID.
   * @param inputCode - Backup code to verify.
   * @param backupCodesJson - JSON string of backup codes.
   * @returns True if code is valid.
   */
  private async verifyBackupCode(
    userId: string,
    inputCode: string,
    backupCodesJson?: string | null
  ): Promise<boolean> {
    if (typeof backupCodesJson !== 'string' || backupCodesJson.length === 0) {
      return false;
    }

    const backupCodes = this.parseBackupCodes(userId, backupCodesJson);
    if (backupCodes === null) {
      return false;
    }

    const codeIndex = backupCodes.indexOf(inputCode);
    if (codeIndex === -1) {
      return false;
    }

    backupCodes.splice(codeIndex, 1);

    await this.repository.updateBackupCodes(userId, JSON.stringify(backupCodes));

    this.logger.info(LogSource.AUTH, 'Backup code used successfully', { userId });
    return true;
  }

  /**
   * Parse backup codes from JSON string.
   * @param userId - User ID for logging.
   * @param backupCodesJson - JSON string of backup codes.
   * @returns Array of backup codes or null if invalid.
   */
  private parseBackupCodes(userId: string, backupCodesJson: string): string[] | null {
    try {
      const parsed: unknown = JSON.parse(backupCodesJson);

      if (!Array.isArray(parsed)) {
        this.logger.warn(LogSource.AUTH, 'Invalid backup codes format', { userId });
        return null;
      }

      const isStringArray = parsed.every((item): item is string => {
        return typeof item === 'string';
      });

      if (!isStringArray) {
        this.logger.warn(LogSource.AUTH, 'Invalid backup codes format', { userId });
        return null;
      }

      return parsed;
    } catch (error) {
      this.logger.warn(LogSource.AUTH, 'Failed to parse backup codes', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Verify TOTP code.
   * @param userId - User ID.
   * @param code - TOTP code to verify.
   * @param mfaSecret - User's MFA secret.
   * @returns True if code is valid.
   */
  private verifyTOTPCode(
    userId: string,
    code: string,
    mfaSecret?: string | null
  ): boolean {
    if (typeof mfaSecret !== 'string' || mfaSecret.length === 0) {
      this.logger.warn(LogSource.AUTH, 'MFA secret not found for user', { userId });
      return false;
    }

    const { windowSize } = this.config;
    const isValid = speakeasy.totp.verify({
      secret: mfaSecret,
      encoding: 'base32',
      token: code,
      window: windowSize,
    });

    if (isValid) {
      this.logger.info(LogSource.AUTH, 'MFA verification successful', { userId });
    } else {
      this.logger.warn(LogSource.AUTH, 'MFA verification failed', { userId });
    }

    return isValid;
  }
}
