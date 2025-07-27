/**
 * MFA repository for multi-factor authentication data access operations.
 * @module modules/core/auth/repositories/mfa.repository
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IUserMFAData } from '@/modules/core/auth/types';

/**
 * MFARepository class for handling MFA data operations.
 */
export class MFARepository {
  private static instance: MFARepository;

  /**
   * Private constructor for singleton pattern.
   * @param db - Database service instance.
   */
  private constructor(private readonly db: DatabaseService) {}

  /**
   * Get singleton instance.
   * @returns MFARepository instance.
   */
  public static getInstance(): MFARepository {
    MFARepository.instance ||= new MFARepository(DatabaseService.getInstance());
    return MFARepository.instance;
  }

  /**
   * Get user MFA data by user ID.
   * @param userId - The user ID.
   * @returns Promise resolving to user MFA data or null.
   */
  async getUserMFAData(userId: string): Promise<IUserMFAData | null> {
    const users = await this.db.query<IUserMFAData>(
      'SELECT id, mfa_secret, mfa_enabled, mfa_backup_codes FROM auth_users WHERE id = ?',
      [userId]
    );
    return users[0] || null;
  }

  /**
   * Update MFA secret and backup codes for a user.
   * @param userId - The user ID.
   * @param secret - The MFA secret.
   * @param backupCodes - The backup codes as JSON string.
   * @returns Promise resolving when update is complete.
   */
  async updateMFASetup(
    userId: string,
    secret: string,
    backupCodes: string
  ): Promise<void> {
    await this.db.execute(
      'UPDATE auth_users SET mfa_secret = ?, mfa_backup_codes = ? WHERE id = ?',
      [secret, backupCodes, userId]
    );
  }

  /**
   * Enable MFA for a user.
   * @param userId - The user ID.
   * @returns Promise resolving when update is complete.
   */
  async enableMFA(userId: string): Promise<void> {
    await this.db.execute(
      'UPDATE auth_users SET mfa_enabled = ? WHERE id = ?',
      [1, userId]
    );
  }

  /**
   * Disable MFA for a user.
   * @param userId - The user ID.
   * @returns Promise resolving when update is complete.
   */
  async disableMFA(userId: string): Promise<void> {
    await this.db.execute(
      'UPDATE auth_users SET mfa_enabled = ?, mfa_secret = ?, mfa_backup_codes = ? WHERE id = ?',
      [0, null, null, userId]
    );
  }

  /**
   * Update backup codes for a user.
   * @param userId - The user ID.
   * @param backupCodes - The backup codes as JSON string.
   * @returns Promise resolving when update is complete.
   */
  async updateBackupCodes(userId: string, backupCodes: string): Promise<void> {
    await this.db.execute(
      'UPDATE auth_users SET mfa_backup_codes = ? WHERE id = ?',
      [backupCodes, userId]
    );
  }

  /**
   * Check if MFA is enabled for a user.
   * @param userId - The user ID.
   * @returns Promise resolving to boolean indicating if MFA is enabled.
   */
  async isEnabled(userId: string): Promise<boolean> {
    const users = await this.db.query<{ mfa_enabled: number }>(
      'SELECT mfa_enabled FROM auth_users WHERE id = ?',
      [userId]
    );
    return users.length > 0 && users[0]?.mfa_enabled === 1;
  }
}
