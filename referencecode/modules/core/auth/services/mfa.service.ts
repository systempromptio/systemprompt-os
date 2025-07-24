/**
 * Multi-Factor Authentication (MFA) service
 */

import { randomBytes } from 'crypto';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import type { MFASetupResult, MFAVerifyInput } from '../types/index.js';
import type { Logger } from '@/modules/types.js';
import { DatabaseService } from '@/modules/core/database/services/database.service.js';

export class MFAService {
  private readonly db: DatabaseService;

  constructor(
    private readonly config: {
      appName: string;
      backupCodeCount: number;
      windowSize: number;
    },
    private readonly logger: Logger,
  ) {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Setup MFA for a user
   */
  async setupMFA(userId: string, email: string): Promise<MFASetupResult> {
    try {
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `${this.config.appName} (${email})`,
        issuer: this.config.appName,
      });

      // Generate backup codes
      const backupCodes = this.generateBackupCodes(this.config.backupCodeCount);

      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

      // Store secret temporarily (not enabled until verified)
      await this.db.execute(
        `
        UPDATE auth_users 
        SET mfa_secret_temp = ?, mfa_backup_codes_temp = ?
        WHERE id = ?
      `,
        [secret.base32, JSON.stringify(backupCodes), userId],
      );

      this.logger.info('MFA setup initiated', { userId });

      return {
        secret: secret.base32,
        qrCodeUrl,
        backupCodes,
      };
    } catch (error) {
      this.logger.error('Failed to setup MFA', { userId, error });
      throw new Error('Failed to setup MFA');
    }
  }

  /**
   * Enable MFA after successful verification
   */
  async enableMFA(userId: string, code: string): Promise<boolean> {
    try {
      // Get temporary secret
      const result = await this.db.query<{
        mfa_secret_temp: string;
        mfa_backup_codes_temp: string;
      }>(
        `
        SELECT mfa_secret_temp, mfa_backup_codes_temp 
        FROM auth_users 
        WHERE id = ?
      `,
        [userId],
      );

      const user = result[0];
      if (!user?.mfa_secret_temp) {
        throw new Error('MFA setup not initiated');
      }

      // Verify code
      const verified = speakeasy.totp.verify({
        secret: user.mfa_secret_temp,
        encoding: 'base32',
        token: code,
        window: this.config.windowSize,
      });

      if (!verified) {
        return false;
      }

      // Enable MFA
      await this.db.execute(
        `
        UPDATE auth_users 
        SET mfa_enabled = true,
            mfa_secret = mfa_secret_temp,
            mfa_backup_codes = mfa_backup_codes_temp,
            mfa_secret_temp = NULL,
            mfa_backup_codes_temp = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        [userId],
      );

      this.logger.info('MFA enabled', { userId });

      return true;
    } catch (error) {
      this.logger.error('Failed to enable MFA', { userId, error });
      throw error;
    }
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(userId: string): Promise<void> {
    try {
      await this.db.execute(
        `
        UPDATE auth_users 
        SET mfa_enabled = false,
            mfa_secret = NULL,
            mfa_backup_codes = NULL,
            mfa_secret_temp = NULL,
            mfa_backup_codes_temp = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        [userId],
      );

      this.logger.info('MFA disabled', { userId });
    } catch (error) {
      this.logger.error('Failed to disable MFA', { userId, error });
      throw new Error('Failed to disable MFA');
    }
  }

  /**
   * Verify MFA code
   */
  async verifyMFA(input: MFAVerifyInput): Promise<boolean> {
    try {
      // Get user MFA data
      const result = await this.db.query<{
        mfa_secret: string;
        mfa_backup_codes: string;
      }>(
        `
        SELECT mfa_secret, mfa_backup_codes 
        FROM auth_users 
        WHERE id = ? AND mfa_enabled = true
      `,
        [input.userId],
      );

      const user = result[0];
      if (!user) {
        return false;
      }

      if (input.isBackupCode) {
        return await this.verifyBackupCode(
          input.userId,
          input.code,
          JSON.parse(user.mfa_backup_codes),
        );
      }

      // Verify TOTP code
      const verified = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: input.code,
        window: this.config.windowSize,
      });

      return verified;
    } catch (error) {
      this.logger.error('Failed to verify MFA', { userId: input.userId, error });
      return false;
    }
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    try {
      const backupCodes = this.generateBackupCodes(this.config.backupCodeCount);

      await this.db.execute(
        `
        UPDATE auth_users 
        SET mfa_backup_codes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        [JSON.stringify(backupCodes), userId],
      );

      this.logger.info('Backup codes regenerated', { userId });

      return backupCodes;
    } catch (error) {
      this.logger.error('Failed to regenerate backup codes', { userId, error });
      throw new Error('Failed to regenerate backup codes');
    }
  }

  /**
   * Verify backup code
   */
  private async verifyBackupCode(
    userId: string,
    code: string,
    backupCodes: string[],
  ): Promise<boolean> {
    const index = backupCodes.indexOf(code);
    if (index === -1) {
      return false;
    }

    // Remove used backup code
    backupCodes.splice(index, 1);

    await this.db.execute(
      `
      UPDATE auth_users 
      SET mfa_backup_codes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [JSON.stringify(backupCodes), userId],
    );

    this.logger.info('Backup code used', { userId });

    return true;
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = randomBytes(6)
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 8)
        .toUpperCase();
      codes.push(code);
    }

    return codes;
  }
}
