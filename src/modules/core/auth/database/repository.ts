import { randomUUID } from 'node:crypto';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { getAuthModule } from '@/modules/core/auth/index';
import type {
 IUser
} from '@/modules/core/auth/types';
import type { OAuthProfile } from '@/modules/core/auth/types/repository.types';
import type {
 SessionMetadata
} from '@/modules/core/auth/types/repository.types';
import {
 ZERO
} from '@/constants/numbers';

/**
 * Repository for authentication-related database operations.
 * Provides methods for OAuth user management and session handling.
 * Authorization (roles/permissions) is handled by the permissions module.
 */
export class AuthRepository {
  private static instance: AuthRepository | undefined;
  private dbService?: DatabaseService;

  /**
   * Creates a new AuthRepository instance.
   */
  private constructor() {
  }

  /**
   * Gets the singleton instance of AuthRepository.
   * @returns AuthRepository instance.
   */
  static getInstance(): AuthRepository {
    this.instance ??= new AuthRepository();
    return this.instance;
  }

  /**
   * Initialize repository.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    this.dbService = DatabaseService.getInstance();
  }

  /**
   * Get database connection.
   * @returns Database connection.
   */
  private async getDatabase(): Promise<DatabaseService> {
    this.dbService ||= DatabaseService.getInstance();
    return this.dbService;
  }

  /**
   * Creates a new authentication session.
   * Sessions store hashed tokens to validate subsequent requests.
   * @param sessionData - Session data object.
   * @param sessionData.userId - User's unique identifier.
   * @param sessionData.tokenHash - Hashed authentication token.
   * @param sessionData.expiresAt - Session expiration timestamp.
   * @param sessionData.metadata - Optional client metadata for the session.
   * @returns Generated session ID.
   */
  async createSession(
    sessionData: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      metadata?: SessionMetadata;
    }
  ): Promise<string> {
    const sessionId = randomUUID();

    const db = await this.getDatabase();
    await db.execute(
      `INSERT INTO auth_sessions
       (id, user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        sessionData.userId,
        sessionData.tokenHash,
        sessionData.expiresAt.toISOString(),
        sessionData.metadata?.ipAddress,
        sessionData.metadata?.userAgent,
      ],
    );

    return sessionId;
  }

  /**
   * Removes expired authentication sessions.
   * Should be called periodically to maintain database hygiene.
   * @returns Number of sessions removed (always ZERO for SQLite due to API limitations).
   */
  async cleanupExpiredSessions(): Promise<number> {
    const db = await this.getDatabase();
    await db.execute(`DELETE FROM auth_sessions WHERE expires_at < datetime('now')`);

    return ZERO;
  }

  /**
   * Creates or updates a user from OAuth authentication using event-based communication.
   * Delegates to auth service which handles the user creation via events.
   * @param provider
   * @param providerId
   * @param profile
   */
  async upsertIUserFromOAuth(
    provider: string,
    providerId: string,
    profile: OAuthProfile,
  ): Promise<IUser> {
    try {
      const authModule = getAuthModule();
      const authService = authModule.exports.service();

      const user = await authService.createOrUpdateUserFromOAuth(provider, providerId, profile);

      if (!user) {
        throw new Error('Failed to create/update OAuth user');
      }

      const result: IUser = {
        id: user.id,
        email: user.email,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      if (user.name !== null && user.name !== undefined) {
        result.name = user.name;
      }
      
      if (user.avatarUrl !== null && user.avatarUrl !== undefined) {
        result.avatarUrl = user.avatarUrl;
      }
      
      result.lastLoginAt = new Date().toISOString();
      
      return result;
    } catch (error) {
      throw new Error(`Failed to upsert OAuth user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieves a user by their unique identifier using event-based communication.
   * Fetches minimal user data via events and combines with roles/permissions.
   * @param userId
   */
  async getIUserById(userId: string): Promise<IUser | null> {
    try {
      const authModule = getAuthModule();
      const authService = authModule.exports.service();

      const userInfo = await authService.requestUserData(userId);

      if (!userInfo) {
        return null;
      }

      return {
        id: userInfo.id,
        email: userId,
        isActive: userInfo.status === 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return null;
    }
  }
}
