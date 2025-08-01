import { randomUUID } from 'node:crypto';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { OAuthService } from '@/modules/core/auth/services/oauth.service';

// Auth-specific user interface - different from the main IUser interface
interface IAuthUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

interface OAuthProfile {
  provider: string;
  providerId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
  lastActivity?: Date;
}
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
  ): Promise<IAuthUser> {
    try {
      const oauthService = OAuthService.getInstance();

      const providerData: {
        provider: string;
        providerId: string;
        email: string;
        name?: string;
        avatarUrl?: string;
      } = {
        provider,
        providerId,
        email: profile.email,
      };

      if (profile.name) {
        providerData.name = profile.name;
      }

      if (profile.avatarUrl) {
        providerData.avatarUrl = profile.avatarUrl;
      }

      const userId = await oauthService.createOrUpdateUserFromOAuth(providerData);

      if (!userId) {
        throw new Error('Failed to create/update OAuth user');
      }

      const result: IAuthUser = {
        id: userId,
        email: profile.email,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (profile.name) {
        result.name = profile.name;
      }

      if (profile.avatarUrl) {
        result.avatarUrl = profile.avatarUrl;
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
  async getIUserById(userId: string): Promise<IAuthUser | null> {
    try {
      const { EventBusService } = await import('@/modules/core/events/services/events.service');
      const { UserEvents } = await import('@/modules/core/events/types/index');
      const eventBus = EventBusService.getInstance();

      return new Promise((resolve) => {
        const requestId = randomUUID();
        const timeout = setTimeout(() => {
          eventBus.off(UserEvents.USER_DATA_RESPONSE, responseHandler);
          resolve(null);
        }, 5000);

        const responseHandler = (event: any) => {
          if (event.requestId === requestId) {
            clearTimeout(timeout);
            eventBus.off(UserEvents.USER_DATA_RESPONSE, responseHandler);

            if (event.user) {
              resolve({
                id: event.user.id,
                email: event.user.email,
                name: event.user.display_name,
                avatarUrl: event.user.avatar_url,
                isActive: event.user.status === 'active',
                createdAt: event.user.created_at || new Date().toISOString(),
                updatedAt: event.user.updated_at || new Date().toISOString(),
              });
            } else {
              resolve(null);
            }
          }
        };

        eventBus.on(UserEvents.USER_DATA_RESPONSE, responseHandler);
        eventBus.emit(UserEvents.USER_DATA_REQUEST, {
          requestId,
          userId
        });
      });
    } catch (error) {
      return null;
    }
  }
}
