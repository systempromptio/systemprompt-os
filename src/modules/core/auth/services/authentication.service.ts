/**
 * Authentication service - handles user authentication, sessions, and tokens.
 * @module auth/services
 */

import {
 createHash, randomBytes, randomUUID
} from 'crypto';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import type { LoggerService } from '@/modules/core/logger/services/logger.service';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { EventBusService } from '@/modules/core/events/services/event-bus.service';
import {
  AuthEvents,
  type LoginFailedEvent,
  type LoginSuccessEvent,
  type SessionCreatedEvent,
  type TokenCreatedEvent,
  type UserDataRequestEvent,
  type UserDataResponseEvent,
  UserEvents
} from '@/modules/core/events/types/index';
import {
  type IAuthCredentialsRow,
  type IAuthSessionsRow,
  type IAuthTokensRow
} from '@/modules/core/auth/types/database.generated';

const SESSION_EXPIRY_HOURS = 24;
const REFRESH_EXPIRY_DAYS = 30;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

interface IAuthResult {
  success: boolean;
  userId?: string;
  sessionId?: string;
  accessToken?: string;
  refreshToken?: string;
  reason?: string;
}

interface IUserBasicInfo {
  id: string;
  username: string;
  email: string;
  status: string;
  emailVerified: boolean;
}

/**
 * Authentication service for managing login, sessions, and tokens.
 */
export class AuthenticationService {
  private static instance: AuthenticationService;
  private dbService?: DatabaseService;
  private eventBusService?: EventBusService;
  private loggerService?: ILogger;
  private eventHandlersSetup = false;

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    // Event handlers will be set up lazily when needed
  }

  /**
   * Get database connection (lazy initialization).
   * @returns Database connection.
   */
  private getDb(): DatabaseService {
    if (!this.dbService) {
      try {
        // Try to get from module registry first
        const { getDatabaseModule } = require('@/modules/core/database/index');
        const databaseModule = getDatabaseModule();
        this.dbService = databaseModule.exports.service();
      } catch (error) {
        // Fallback to direct import if module not available in registry
        const { DatabaseService } = require('@/modules/core/database/services/database.service');
        this.dbService = DatabaseService.getInstance();
      }
    }
    return this.dbService;
  }

  /**
   * Get event bus (lazy initialization).
   * @returns Event bus instance.
   */
  private getEventBus(): EventBusService {
    if (!this.eventBusService) {
      try {
        // Try to get from module registry first
        const { getEventsModule } = require('@/modules/core/events/index');
        const eventsModule = getEventsModule();
        this.eventBusService = eventsModule.exports.eventBus();
      } catch (error) {
        // Fallback to direct import if module not available in registry
        const { EventBusService } = require('@/modules/core/events/services/event-bus.service');
        this.eventBusService = EventBusService.getInstance();
      }
    }
    return this.eventBusService;
  }

  /**
   * Get logger (lazy initialization).
   * @returns Logger instance.
   */
  private getLogger(): ILogger {
    if (!this.loggerService) {
      try {
        // Try to get from module registry first
        const { getLoggerModule } = require('@/modules/core/logger/index');
        const loggerModule = getLoggerModule();
        this.loggerService = loggerModule.exports.service();
      } catch (error) {
        // Fallback to direct import if module not available in registry
        const { LoggerService } = require('@/modules/core/logger/services/logger.service');
        this.loggerService = LoggerService.getInstance();
      }
    }
    return this.loggerService;
  }

  /**
   * Get singleton instance.
   * @returns The authentication service instance.
   */
  static getInstance(): AuthenticationService {
    AuthenticationService.instance ||= new AuthenticationService();
    return AuthenticationService.instance;
  }

  /**
   * Setup event handlers for user data requests.
   */
  private setupEventHandlers(): void {
    if (this.eventHandlersSetup) {
      return;
    }
    
    try {
      this.getEventBus().on<UserDataRequestEvent>(UserEvents.USER_DATA_REQUEST, async (data: unknown) => {
        const event = data as UserDataRequestEvent;
        const user = await this.fetchUserData(event);
        const response: UserDataResponseEvent = {
          requestId: event.requestId,
          user
        };
        this.getEventBus().emit(UserEvents.USER_DATA_RESPONSE, response);
      });
      
      this.eventHandlersSetup = true;
    } catch (error) {
      // Event bus not available yet, will be set up later
    }
  }

  /**
   * Ensure service is initialized.
   */
  private ensureInitialized(): void {
    if (!this.eventHandlersSetup) {
      this.setupEventHandlers();
    }
  }

  /**
   * Authenticate a user with username/email and password.
   * @param username - Username or email.
   * @param password - Password.
   * @param ipAddress - IP address.
   * @param userAgent - User agent.
   * @returns Authentication result.
   */
  async authenticateUser(
    username: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IAuthResult> {
    this.ensureInitialized();
    try {
      const user = await this.requestUserData(username);

      if (!user) {
        return this.handleFailedLogin(username, 'Invalid credentials', ipAddress);
      }

      if (user.status !== 'active') {
        return this.handleFailedLogin(username, `Account is ${user.status}`, ipAddress);
      }

      const credentials = await this.getCredentials(user.id);

      if (!credentials) {
        return this.handleFailedLogin(username, 'No password set', ipAddress);
      }

      if (credentials.locked_until && new Date(credentials.locked_until) > new Date()) {
        return this.handleFailedLogin(username, 'Account is locked', ipAddress);
      }

      if (!this.verifyPassword(password, credentials.password_hash!)) {
        await this.incrementLoginAttempts(user.id, credentials.login_attempts || 0);
        return this.handleFailedLogin(username, 'Invalid credentials', ipAddress);
      }

      const session = await this.createSession(user.id, ipAddress, userAgent);

      await this.updateLastLogin(user.id);

      const event: LoginSuccessEvent = {
        userId: user.id,
        sessionId: session.id,
        ipAddress: ipAddress || '',
        userAgent: userAgent || '',
        timestamp: new Date()
      };
      this.getEventBus().emit(AuthEvents.LOGIN_SUCCESS, event);

      return {
        success: true,
        userId: user.id,
        sessionId: session.id,
        accessToken: session.token,
        refreshToken: session.refreshToken
      };
    } catch (error) {
      this.logger.error(LogSource.AUTH, 'Authentication error', { error: error instanceof Error ? error.message : String(error) });
      return {
        success: false,
        reason: 'Authentication failed'
      };
    }
  }

  /**
   * Create a new session.
   * @param userId - User ID.
   * @param ipAddress - IP address.
   * @param userAgent - User agent.
   * @returns Session with tokens.
   */
  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ id: string; token: string; refreshToken: string }> {
    this.ensureInitialized();
    const sessionId = randomUUID();
    const token = this.generateToken();
    const refreshToken = this.generateToken();
    const tokenHash = this.hashToken(token);
    const refreshTokenHash = this.hashToken(refreshToken);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
    const refreshExpiresAt = new Date(now.getTime() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await this.db.execute(
      `INSERT INTO auth_sessions 
       (id, user_id, token_hash, refresh_token_hash, type, ip_address, user_agent, 
        expires_at, refresh_expires_at, created_at, last_activity_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId, userId, tokenHash, refreshTokenHash, 'web',
        ipAddress || null, userAgent || null,
        expiresAt.toISOString(), refreshExpiresAt.toISOString(),
        now.toISOString(), now.toISOString()
      ]
    );

    const event: SessionCreatedEvent = {
      sessionId,
      userId,
      type: 'web',
      expiresAt,
      timestamp: now
    };
    this.eventBus.emit(AuthEvents.SESSION_CREATED, event);

    return {
 id: sessionId,
token,
refreshToken
};
  }

  /**
   * Validate a session token.
   * @param token - Session token.
   * @returns User ID if valid, null otherwise.
   */
  async validateSession(token: string): Promise<string | null> {
    const tokenHash = this.hashToken(token);

    const sessions = await this.db.query<IAuthSessionsRow>(
      `SELECT * FROM auth_sessions 
       WHERE token_hash = ? AND revoked_at IS NULL 
       AND datetime(expires_at) > datetime('now')`,
      [tokenHash]
    );

    if (sessions.length === 0) {
      return null;
    }

    const session = sessions[0];
    if (!session) {
      return null;
    }

    await this.db.execute(
      `UPDATE auth_sessions SET last_activity_at = datetime('now') WHERE id = ?`,
      [session.id]
    );

    return session.user_id;
  }

  /**
   * Create an API token.
   * @param userId - User ID.
   * @param name - Token name.
   * @param scope - Token scope.
   * @param expiresInDays - Expiration in days.
   * @returns Token info.
   */
  async createApiToken(
    userId: string,
    name: string,
    scope: string[] = [],
    expiresInDays?: number
  ): Promise<{ id: string; token: string }> {
    const tokenId = randomUUID();
    const token = `sp_${randomBytes(24).toString('hex')}`;
    const tokenHash = this.hashToken(token);

    const now = new Date();
    const expiresAt = expiresInDays
      ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await this.db.execute(
      `INSERT INTO auth_tokens 
       (id, user_id, name, token_hash, type, scope, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tokenId, userId, name, tokenHash, 'api',
        JSON.stringify(scope),
        expiresAt?.toISOString() || null,
        now.toISOString()
      ]
    );

    const event: TokenCreatedEvent = {
      tokenId,
      userId,
      type: 'api',
      name,
      expiresAt: expiresAt || new Date(),
      timestamp: now
    };
    this.eventBus.emit(AuthEvents.TOKEN_CREATED, event);

    return {
 id: tokenId,
token
};
  }

  /**
   * Validate an API token.
   * @param token - API token.
   * @returns User ID if valid, null otherwise.
   */
  async validateApiToken(token: string): Promise<string | null> {
    const tokenHash = this.hashToken(token);

    const tokens = await this.db.query<IAuthTokensRow>(
      `SELECT * FROM auth_tokens 
       WHERE token_hash = ? AND is_revoked = 0 
       AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`,
      [tokenHash]
    );

    if (tokens.length === 0) {
      return null;
    }

    const apiToken = tokens[0];
    if (!apiToken) {
      return null;
    }

    await this.db.execute(
      `UPDATE auth_tokens SET last_used_at = datetime('now') WHERE id = ?`,
      [apiToken.id]
    );

    return apiToken.user_id;
  }

  /**
   * Revoke a session.
   * @param sessionId - Session ID.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.db.execute(
      `UPDATE auth_sessions SET revoked_at = datetime('now') WHERE id = ?`,
      [sessionId]
    );

    this.eventBus.emit(AuthEvents.SESSION_REVOKED, {
      sessionId,
      timestamp: new Date()
    });
  }

  /**
   * Request user data from users module via events.
   * @param username - Username or email.
   * @returns User data or null.
   */
  private async requestUserData(username: string): Promise<IUserBasicInfo | null> {
    return await new Promise((resolve) => {
      const requestId = randomUUID();

      const handler = (event: UserDataResponseEvent) => {
        if (event.requestId === requestId) {
          this.eventBus.off(UserEvents.USER_DATA_RESPONSE, handler);
          resolve(event.user);
        }
      };

      this.eventBus.on(UserEvents.USER_DATA_RESPONSE, handler as (data: unknown) => void);

      const request: UserDataRequestEvent = {
        requestId,
        username: username.includes('@') ? '' : username,
        email: username.includes('@') ? username : ''
      };
      this.eventBus.emit(UserEvents.USER_DATA_REQUEST, request);

      setTimeout(() => {
        this.eventBus.off(UserEvents.USER_DATA_RESPONSE, handler);
        resolve(null);
      }, 5000);
    });
  }

  /**
   * Fetch user data for event response.
   * @param event - User data request event.
   * @param _event
   * @returns User data or null.
   */
  private async fetchUserData(_event: UserDataRequestEvent): Promise<IUserBasicInfo | null> {
    return null;
  }

  /**
   * Get user credentials.
   * @param userId - User ID.
   * @returns Credentials or null.
   */
  private async getCredentials(userId: string): Promise<IAuthCredentialsRow | null> {
    const results = await this.db.query<IAuthCredentialsRow>(
      'SELECT * FROM auth_credentials WHERE user_id = ?',
      [userId]
    );
    return results[0] || null;
  }

  /**
   * Handle failed login.
   * @param username - Username or email.
   * @param reason - Failure reason.
   * @param ipAddress - IP address.
   * @returns Failure result.
   */
  private handleFailedLogin(
    username: string,
    reason: string,
    ipAddress?: string
  ): IAuthResult {
    const event: LoginFailedEvent = {
      username: username.includes('@') ? '' : username,
      email: username.includes('@') ? username : '',
      reason,
      ipAddress: ipAddress || '',
      timestamp: new Date()
    };
    this.eventBus.emit(AuthEvents.LOGIN_FAILED, event);

    return {
      success: false,
      reason
    };
  }

  /**
   * Increment login attempts.
   * @param userId - User ID.
   * @param currentAttempts - Current attempts.
   */
  private async incrementLoginAttempts(userId: string, currentAttempts: number): Promise<void> {
    const newAttempts = currentAttempts + 1;
    let lockedUntil: string | null = null;

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockDate = new Date();
      lockDate.setMinutes(lockDate.getMinutes() + LOCKOUT_DURATION_MINUTES);
      lockedUntil = lockDate.toISOString();
    }

    await this.db.execute(
      `UPDATE auth_credentials 
       SET login_attempts = ?, locked_until = ? 
       WHERE user_id = ?`,
      [newAttempts, lockedUntil, userId]
    );
  }

  /**
   * Update last login time.
   * @param userId - User ID.
   */
  private async updateLastLogin(userId: string): Promise<void> {
    await this.db.execute(
      `UPDATE auth_credentials 
       SET last_login_at = datetime('now'), login_attempts = 0, locked_until = NULL 
       WHERE user_id = ?`,
      [userId]
    );
  }

  /**
   * Hash a password.
   * @param password - Plain text password.
   * @returns Hashed password.
   */
  private hashPassword(password: string): string {
    return createHash('sha256').update(password)
.digest('hex');
  }

  /**
   * Verify a password.
   * @param password - Plain text password.
   * @param hash - Password hash.
   * @returns True if matches.
   */
  private verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  /**
   * Generate a random token.
   * @returns Generated token.
   */
  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Hash a token.
   * @param token - Token to hash.
   * @returns Hashed token.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token)
.digest('hex');
  }
}
