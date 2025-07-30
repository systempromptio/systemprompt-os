/**
 * MFA repository for multi-factor authentication data access operations.
 * @module modules/core/auth/repositories/mfa.repository
 */

import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IUserMFAData } from '@/modules/core/auth/types';

/**
 * MFARepository class for handling MFA data operations.
 */
export class MFARepository {
  private static instance: MFARepository;
  private dbService?: DatabaseService;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   * @returns MFARepository instance.
   */
  public static getInstance(): MFARepository {
    MFARepository.instance ||= new MFARepository();
    return MFARepository.instance;
  }

  /**
   * Initialize repository.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    // Database will be fetched lazily via getDatabase()
    this.dbService = undefined;
  }

  /**
   * Get database connection.
   * @returns Database connection.
   */
  private async getDatabase(): Promise<DatabaseService> {
    if (!this.dbService) {
      try {
        // Try to get from module registry first
        const { getDatabaseModule } = await import('@/modules/core/database/index');
        const databaseModule = getDatabaseModule();
        this.dbService = databaseModule.exports.service();
      } catch (error) {
        // Fallback to direct import if module not available in registry
        const { DatabaseService } = await import('@/modules/core/database/services/database.service');
        this.dbService = DatabaseService.getInstance();
      }
    }
    return this.dbService;
  }

  /**
   * Get user MFA data by user ID.
   * @param userId - The user ID.
   * @returns Promise resolving to user MFA data or null.
   */
  async getUserMFAData(userId: string): Promise<IUserMFAData | null> {
    const db = await this.getDatabase();
    const users = await db.query<IUserMFAData>(
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
    const db = await this.getDatabase();
    await db.execute(
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
    const db = await this.getDatabase();
    await db.execute(
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
    const db = await this.getDatabase();
    await db.execute(
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
    const db = await this.getDatabase();
    await db.execute(
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
    const db = await this.getDatabase();
    const users = await db.query<{ mfa_enabled: number }>(
      'SELECT mfa_enabled FROM auth_users WHERE id = ?',
      [userId]
    );
    return users.length > 0 && users[0]?.mfa_enabled === 1;
  }
}
