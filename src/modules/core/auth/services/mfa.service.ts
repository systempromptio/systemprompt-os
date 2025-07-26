/**
 * MFAService class for managing Multi-Factor Authentication.
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { ILogger } from '@/modules/core/logger/types';
import { LogSource } from '@/modules/core/logger/types';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';

export interface MFAConfig {
  appName: string;
  backupCodeCount: number;
  windowSize: number;
}

export interface MFASetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MFAVerifyParams {
  userId: string;
  code: string;
  isBackupCode?: boolean;
}

export interface UserMFAData {
  id: string;
  mfa_secret?: string | null;
  mfa_enabled?: number;
  mfa_backup_codes?: string | null;
}

export class MFAError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userId?: string
  ) {
    super(message);
    this.name = 'MFAError';
  }
}

export class MFASetupError extends MFAError {
  constructor(message: string, userId?: string) {
    super(message, 'MFA_SETUP_ERROR', userId);
    this.name = 'MFASetupError';
  }
}

export class MFAVerificationError extends MFAError {
  constructor(message: string, userId?: string) {
    super(message, 'MFA_VERIFICATION_ERROR', userId);
    this.name = 'MFAVerificationError';
  }
}

export class MFAService {
  private static instance: MFAService;
  private readonly config: MFAConfig;
  private readonly logger: ILogger;
  private readonly db: DatabaseService;

  /**
   * Get singleton instance.
   */
  public static getInstance(): MFAService {
    if (!MFAService.instance) {
      throw new Error('MFAService must be initialized with config and logger first');
    }
    return MFAService.instance;
  }

  /**
   * Initialize MFAService with configuration.
   * @param config
   * @param logger
   */
  public static initialize(config: MFAConfig, logger: ILogger): MFAService {
    MFAService.instance = new MFAService(config, logger);
    return MFAService.instance;
  }

  /**
   * Constructor for MFAService.
   * @param config
   * @param logger
   */
  constructor(config: MFAConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
    this.db = DatabaseService.getInstance();
  }

  /**
   * Setup MFA for a user.
   * @param userId
   * @param email
   */
  async setupMFA(userId: string, email: string): Promise<MFASetupResult> {
    this.logger.debug(LogSource.AUTH, 'Setting up MFA for user', {
 userId,
email
});

    const secret = speakeasy.generateSecret({
      name: `${this.config.appName} (${email})`,
      issuer: this.config.appName,
    });

    if (!secret.otpauth_url) {
      throw new Error('Failed to generate OTP auth URL');
    }
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    const backupCodes = this.generateBackupCodes();

    await this.db.execute(
      'UPDATE auth_users SET mfa_secret = ?, mfa_backup_codes = ? WHERE id = ?',
      [secret.base32, JSON.stringify(backupCodes), userId]
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
   * @param userId
   * @param code
   */
  async enableMFA(userId: string, code: string): Promise<boolean> {
    this.logger.debug(LogSource.AUTH, 'Enabling MFA for user', { userId });

    const users = await this.db.query<UserMFAData>(
      'SELECT id, mfa_secret, mfa_backup_codes FROM auth_users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new MFASetupError('User not found', userId);
    }

    const user = users[0];
    if (!user) {
      throw new MFASetupError('User not found', userId);
    }

    if (!user.mfa_secret || user.mfa_secret === null
        || !user.mfa_backup_codes || user.mfa_backup_codes === null) {
      throw new MFASetupError('MFA not set up', userId);
    }

    const isValid = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: code,
      window: this.config.windowSize,
    });

    if (!isValid) {
      this.logger.warn(LogSource.AUTH, 'Invalid MFA code during enable', { userId });
      return false;
    }

    await this.db.execute(
      'UPDATE auth_users SET mfa_enabled = ? WHERE id = ?',
      [1, userId]
    );

    this.logger.info(LogSource.AUTH, 'MFA enabled for user', { userId });
    return true;
  }

  /**
   * Verify MFA code for a user.
   * @param params
   */
  async verifyMFA(params: MFAVerifyParams): Promise<boolean> {
    const {
 userId, code, isBackupCode = false
} = params;
    this.logger.debug(LogSource.AUTH, 'Verifying MFA for user', {
 userId,
isBackupCode
});

    const users = await this.db.query<UserMFAData>(
      'SELECT id, mfa_secret, mfa_enabled, mfa_backup_codes FROM auth_users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new MFAVerificationError('User not found', userId);
    }

    const user = users[0];
    if (!user) {
      throw new MFAVerificationError('User not found', userId);
    }

    if (user.mfa_enabled !== 1) {
      this.logger.warn(LogSource.AUTH, 'MFA verification attempted for user without MFA enabled', { userId });
      return false;
    }

    if (isBackupCode) {
      return await this.verifyBackupCode(userId, code, user.mfa_backup_codes);
    }

    if (!user.mfa_secret) {
      this.logger.warn(LogSource.AUTH, 'MFA secret not found for user', { userId });
      return false;
    }

    const isValid = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: code,
      window: this.config.windowSize,
    });

    if (isValid) {
      this.logger.info(LogSource.AUTH, 'MFA verification successful', { userId });
    } else {
      this.logger.warn(LogSource.AUTH, 'MFA verification failed', { userId });
    }

    return isValid;
  }

  /**
   * Disable MFA for a user.
   * @param userId
   */
  async disableMFA(userId: string): Promise<void> {
    this.logger.debug(LogSource.AUTH, 'Disabling MFA for user', { userId });

    await this.db.execute(
      'UPDATE auth_users SET mfa_enabled = ?, mfa_secret = ?, mfa_backup_codes = ? WHERE id = ?',
      [0, null, null, userId]
    );

    this.logger.info(LogSource.AUTH, 'MFA disabled for user', { userId });
  }

  /**
   * Regenerate backup codes for a user.
   * @param userId
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    this.logger.debug(LogSource.AUTH, 'Regenerating backup codes for user', { userId });

    const users = await this.db.query<UserMFAData>(
      'SELECT id, mfa_enabled FROM auth_users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new MFAError('User not found', 'USER_NOT_FOUND', userId);
    }

    const user = users[0];
    if (!user) {
      throw new MFAError('User not found', 'USER_NOT_FOUND', userId);
    }

    if (user.mfa_enabled !== 1) {
      throw new MFAError('MFA not enabled', 'MFA_NOT_ENABLED', userId);
    }

    const backupCodes = this.generateBackupCodes();

    await this.db.execute(
      'UPDATE auth_users SET mfa_backup_codes = ? WHERE id = ?',
      [JSON.stringify(backupCodes), userId]
    );

    this.logger.info(LogSource.AUTH, 'Backup codes regenerated for user', { userId });
    return backupCodes;
  }

  /**
   * Check if MFA is enabled for a user.
   * @param userId
   */
  async isEnabled(userId: string): Promise<boolean> {
    const users = await this.db.query<UserMFAData>(
      'SELECT mfa_enabled FROM auth_users WHERE id = ?',
      [userId]
    );

    return users.length > 0 && users[0]?.mfa_enabled === 1;
  }

  /**
   * Generate backup codes.
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.config.backupCodeCount; i++) {
      codes.push(crypto.randomBytes(4).toString('hex')
.toUpperCase());
    }
    return codes;
  }

  /**
   * Verify backup code and consume it.
   * @param userId
   * @param code
   * @param backupCodesJson
   */
  private async verifyBackupCode(userId: string, code: string, backupCodesJson?: string | null): Promise<boolean> {
    if (!backupCodesJson) {
      return false;
    }

    let backupCodes: string[];
    try {
      const parsed: unknown = JSON.parse(backupCodesJson);
      if (!Array.isArray(parsed) || !parsed.every((code): code is string => { return typeof code === 'string' })) {
        this.logger.warn(LogSource.AUTH, 'Invalid backup codes format', { userId });
        return false;
      }
      backupCodes = parsed;
    } catch (error) {
      this.logger.warn(LogSource.AUTH, 'Failed to parse backup codes', {
 userId,
error: error instanceof Error ? error.message : String(error)
});
      return false;
    }

    const codeIndex = backupCodes.indexOf(code);
    if (codeIndex === -1) {
      return false;
    }

    backupCodes.splice(codeIndex, 1);

    await this.db.execute(
      'UPDATE auth_users SET mfa_backup_codes = ? WHERE id = ?',
      [JSON.stringify(backupCodes), userId]
    );

    this.logger.info(LogSource.AUTH, 'Backup code used successfully', { userId });
    return true;
  }
}
