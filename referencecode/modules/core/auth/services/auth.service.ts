/**
 * Enhanced authentication service with MFA, tokens, and audit
 */

import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import type { AuthUser, LoginInput, LoginResult, AuthSession } from '../types/index.js';
import type { Logger } from '@/modules/types.js';
import { DatabaseService } from '@/modules/core/database/services/database.service.js';
import type { MFAService } from './mfa.service.js';
import type { TokenService } from './token.service.js';
import type { AuthAuditService } from './audit.service.js';

export class AuthService {
  private readonly db: DatabaseService;

  constructor(
    private readonly mfaService: MFAService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuthAuditService,
    private readonly config: {
      session: {
        maxConcurrent: number;
        absoluteTimeout: number;
        inactivityTimeout: number;
      };
      security: {
        maxLoginAttempts: number;
        lockoutDuration: number;
        passwordMinLength: number;
      };
    },
    private readonly logger: Logger,
  ) {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Authenticate user
   */
  async login(input: LoginInput): Promise<LoginResult> {
    try {
      // Check for account lockout
      const failedAttempts = await this.auditService.getFailedLoginAttempts(
        input.email,
        new Date(Date.now() - this.config.security.lockoutDuration * 1000),
      );

      if (failedAttempts >= this.config.security.maxLoginAttempts) {
        await this.auditService.recordFailedLogin(
          input.email,
          'Account locked',
          input.ipAddress,
          input.userAgent,
        );
        throw new Error('Account locked due to too many failed attempts');
      }

      // Find or create user
      let user = await this.findUserByEmail(input.email);

      if (!user) {
        if (input.provider && input.providerId) {
          // Create user from OAuth provider
          user = await this.createUserFromProvider(input);
        } else {
          await this.auditService.recordFailedLogin(
            input.email,
            'User not found',
            input.ipAddress,
            input.userAgent,
          );
          throw new Error('Invalid credentials');
        }
      }

      // Verify password if provided
      if (input.password && !input.provider) {
        const valid = await this.verifyPassword(user.id, input.password);
        if (!valid) {
          await this.auditService.recordFailedLogin(
            input.email,
            'Invalid password',
            input.ipAddress,
            input.userAgent,
          );
          throw new Error('Invalid credentials');
        }
      }

      // Check if user is active
      if (!user.isActive) {
        await this.auditService.recordFailedLogin(
          input.email,
          'Account disabled',
          input.ipAddress,
          input.userAgent,
        );
        throw new Error('Account disabled');
      }

      // Update last login
      await this.updateLastLogin(user.id);

      // Check if MFA is required
      if (user.mfaEnabled) {
        // Create temporary session for MFA
        const tempSession = await this.createSession(user.id, {
          ...(input.ipAddress && { ipAddress: input.ipAddress }),
          ...(input.userAgent && { userAgent: input.userAgent }),
          temporary: true,
        });

        return {
          user,
          session: tempSession,
          accessToken: '',
          refreshToken: '',
          requiresMFA: true,
        };
      }

      // Create session and tokens
      const session = await this.createSession(user.id, {
        ...(input.ipAddress && { ipAddress: input.ipAddress }),
        ...(input.userAgent && { userAgent: input.userAgent }),
      });

      // Get user roles (integrate with permissions module when available)
      const roles = ['user']; // Default role

      const accessToken = await this.tokenService.createJWT(user.id, user.email, user.name, roles);

      const refreshToken = await this.tokenService.createToken({
        userId: user.id,
        type: 'refresh',
        scope: ['refresh'],
      });

      // Record successful login
      await this.auditService.recordLogin(user.id, input.ipAddress, input.userAgent, {
        provider: input.provider,
      });

      return {
        user,
        session,
        accessToken,
        refreshToken: refreshToken.token,
        requiresMFA: false,
      };
    } catch (error) {
      this.logger.error('Login failed', { email: input.email, error });
      throw error;
    }
  }

  /**
   * Complete MFA login
   */
  async completeMFALogin(sessionId: string, code: string): Promise<LoginResult> {
    try {
      // Get temporary session
      const session = await this.getSession(sessionId);
      if (!session?.metadata?.['temporary']) {
        throw new Error('Invalid session');
      }

      // Verify MFA code
      const verified = await this.mfaService.verifyMFA({
        userId: session.userId,
        code,
      });

      if (!verified) {
        await this.auditService.recordMFAEvent(
          session.userId,
          'mfa.failed',
          false,
          session.ipAddress,
          session.userAgent,
          'Invalid code',
        );
        throw new Error('Invalid MFA code');
      }

      // Get user
      const user = await this.getUserById(session.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update session to permanent
      await this.updateSession(sessionId, { temporary: false });

      // Get user roles
      const roles = ['user']; // Default role

      const accessToken = await this.tokenService.createJWT(user.id, user.email, user.name, roles);

      const refreshToken = await this.tokenService.createToken({
        userId: user.id,
        type: 'refresh',
        scope: ['refresh'],
      });

      // Record successful MFA
      await this.auditService.recordMFAEvent(
        user.id,
        'mfa.verify',
        true,
        session.ipAddress,
        session.userAgent,
      );

      return {
        user,
        session,
        accessToken,
        refreshToken: refreshToken.token,
        requiresMFA: false,
      };
    } catch (error) {
      this.logger.error('MFA login failed', { sessionId, error });
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(sessionId: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return;
      }

      // Revoke session
      await this.revokeSession(sessionId);

      // Record logout
      await this.auditService.recordLogout(session.userId, session.ipAddress, session.userAgent);
    } catch (error) {
      this.logger.error('Logout failed', { sessionId, error });
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      // Validate refresh token
      const validation = await this.tokenService.validateToken(refreshToken);
      if (!validation.valid || !validation.token || validation.token.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      // Get user
      const user = await this.getUserById(validation.userId!);
      if (!user?.isActive) {
        throw new Error('User not found or disabled');
      }

      // Get user roles
      const roles = ['user']; // Default role

      // Create new tokens
      const accessToken = await this.tokenService.createJWT(user.id, user.email, user.name, roles);

      // Revoke old refresh token
      await this.tokenService.revokeToken(validation.token.id);

      // Create new refresh token
      const newRefreshToken = await this.tokenService.createToken({
        userId: user.id,
        type: 'refresh',
        scope: ['refresh'],
      });

      return {
        accessToken,
        refreshToken: newRefreshToken.token,
      };
    } catch (error) {
      this.logger.error('Token refresh failed', { error });
      throw error;
    }
  }

  /**
   * Create session
   */
  private async createSession(
    userId: string,
    options: {
      ipAddress?: string;
      userAgent?: string;
      temporary?: boolean;
    },
  ): Promise<AuthSession> {
    // Check concurrent sessions
    const activeSessions = await this.getActiveUserSessions(userId);
    if (activeSessions.length >= this.config.session.maxConcurrent) {
      // Revoke oldest session
      const oldest = activeSessions.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      )[0];
      if (!oldest) {throw new Error('oldest is required');}
      await this.revokeSession(oldest.id);
    }

    const id = this.generateId();
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + this.config.session.absoluteTimeout * 1000);

    await this.db.execute(
      `
      INSERT INTO auth_sessions 
      (id, user_id, token, ip_address, user_agent, expires_at, metadata, created_at, last_activity_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
      [
        id,
        userId,
        token,
        options.ipAddress || null,
        options.userAgent || null,
        expiresAt.toISOString(),
        options.temporary ? JSON.stringify({ temporary: true }) : null,
      ],
    );

    return {
      id,
      userId,
      token,
      ...(options.ipAddress && { ipAddress: options.ipAddress }),
      ...(options.userAgent && { userAgent: options.userAgent }),
      expiresAt,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      isActive: true,
      ...(options.temporary && { metadata: { temporary: true } }),
    };
  }

  /**
   * Get session
   */
  private async getSession(sessionId: string): Promise<AuthSession | null> {
    const result = await this.db.query<any>(
      `
      SELECT * FROM auth_sessions 
      WHERE id = ? AND is_active = true
    `,
      [sessionId],
    );

    const row = result[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      lastActivityAt: new Date(row.last_activity_at),
      isActive: true,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
   * Update session
   */
  private async updateSession(sessionId: string, metadata: Record<string, unknown>): Promise<void> {
    await this.db.execute(
      `
      UPDATE auth_sessions 
      SET metadata = ?, last_activity_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [JSON.stringify(metadata), sessionId],
    );
  }

  /**
   * Revoke session
   */
  private async revokeSession(sessionId: string): Promise<void> {
    await this.db.execute(
      `
      UPDATE auth_sessions 
      SET is_active = false 
      WHERE id = ?
    `,
      [sessionId],
    );
  }

  /**
   * Get active user sessions
   */
  private async getActiveUserSessions(userId: string): Promise<AuthSession[]> {
    const result = await this.db.query<any>(
      `
      SELECT * FROM auth_sessions 
      WHERE user_id = ? AND is_active = true AND expires_at > datetime('now')
      ORDER BY created_at DESC
    `,
      [userId],
    );

    return result.map((row) => ({
      id: row.id,
      userId: row.user_id,
      token: row.token,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      lastActivityAt: new Date(row.last_activity_at),
      isActive: true,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * Find user by email
   */
  private async findUserByEmail(email: string): Promise<AuthUser | null> {
    const result = await this.db.query<any>(
      `
      SELECT * FROM auth_users WHERE email = ?
    `,
      [email.toLowerCase()],
    );

    const row = result[0];
    if (!row) {
      return null;
    }

    return this.mapRowToUser(row);
  }

  /**
   * Get user by ID
   */
  private async getUserById(userId: string): Promise<AuthUser | null> {
    const result = await this.db.query<any>(
      `
      SELECT * FROM auth_users WHERE id = ?
    `,
      [userId],
    );

    const row = result[0];
    if (!row) {
      return null;
    }

    return this.mapRowToUser(row);
  }

  /**
   * Create user from provider
   */
  private async createUserFromProvider(input: LoginInput): Promise<AuthUser> {
    const id = this.generateId();
    const now = new Date();

    await this.db.execute(
      `
      INSERT INTO auth_users 
      (id, email, name, provider, provider_id, is_active, mfa_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, true, false, ?, ?)
    `,
      [
        id,
        input.email.toLowerCase(),
        input.providerData?.['name'] || input.email.split('@')[0],
        input.provider,
        input.providerId,
        now.toISOString(),
        now.toISOString(),
      ],
    );

    return {
      id,
      email: input.email.toLowerCase(),
      name: ((): string => {
        if (typeof input.providerData?.['name'] === 'string') {
          return input.providerData['name'];
        }
        return input.email.split('@')[0] || 'user';
      })(),
      provider: input.provider!,
      providerId: input.providerId!,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      mfaEnabled: false,
    };
  }

  /**
   * Update last login
   */
  private async updateLastLogin(userId: string): Promise<void> {
    await this.db.execute(
      `
      UPDATE auth_users 
      SET last_login_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `,
      [userId],
    );
  }

  /**
   * Verify password
   */
  private async verifyPassword(userId: string, password: string): Promise<boolean> {
    const result = await this.db.query<{ password_hash: string }>(
      `
      SELECT password_hash FROM auth_users WHERE id = ?
    `,
      [userId],
    );

    const row = result[0];
    if (!row?.password_hash) {
      return false;
    }

    return bcrypt.compare(password, row.password_hash);
  }

  /**
   * Map database row to user
   */
  private mapRowToUser(row: any): AuthUser {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      provider: row.provider,
      providerId: row.provider_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      ...(row.last_login_at && { lastLoginAt: new Date(row.last_login_at) }),
      isActive: Boolean(row.is_active),
      mfaEnabled: Boolean(row.mfa_enabled),
      mfaSecret: row.mfa_secret,
      ...(row.mfa_backup_codes && { mfaBackupCodes: JSON.parse(row.mfa_backup_codes) }),
    };
  }

  /**
   * Generate ID
   */
  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate token
   */
  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }
}
