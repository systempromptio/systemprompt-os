/**
 * Auth service for handling authentication operations in the system.
 * @file Auth service for handling authentication.
 * @module modules/core/auth/services/auth.service
 */

import type { LoginInput, LoginResult } from '@/modules/core/auth/types/index';
import type { IUsersRow } from '@/modules/core/users/types/database.generated';
import { UsersStatus } from '@/modules/core/users/types/database.generated';
import type { IAuthSessionsRow } from '@/modules/core/auth/types/database.generated';
import { AuthenticationService } from '@/modules/core/auth/services/authentication.service';
import { MFAService } from '@/modules/core/auth/services/mfa.service';
import { TokenService } from '@/modules/core/auth/services/token.service';

/**
 * AuthService class for handling authentication operations.
 * Implements singleton pattern to ensure single instance across the application.
 */
export class AuthService {
  private static instance: AuthService;
  private readonly authenticationService: AuthenticationService;
  private readonly mfaService: MFAService;
  private readonly tokenService: TokenService;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.authenticationService = AuthenticationService.getInstance();
    this.mfaService = MFAService.getInstance();
    this.tokenService = TokenService.getInstance();
  }

  /**
   * Get singleton instance of AuthService.
   * @returns {AuthService} The singleton instance.
   */
  public static getInstance(): AuthService {
    AuthService.instance ||= new AuthService();
    return AuthService.instance;
  }

  /**
   * Authenticate user with credentials.
   * @param {LoginInput} input - Login credentials and metadata.
   * @returns {Promise<LoginResult>} Authentication result.
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const result = await this.authenticationService.authenticateUser(
      input.email,
      input.password ?? '',
      input.ipAddress,
      input.userAgent,
    );

    if (!result.success) {
      throw new Error(result.reason || 'Authentication failed');
    }

    const mfaEnabled = await this.mfaService.isEnabled(result.userId!);

    if (mfaEnabled) {
      const session: IAuthSessionsRow = {
        id: result.sessionId!,
        user_id: result.userId!,
        token_hash: '',
        refresh_token_hash: null,
        type: 'mfa_pending',
        ip_address: input.ipAddress || null,
        user_agent: input.userAgent || null,
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        refresh_expires_at: null,
        revoked_at: null,
        created_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      };

      const user: IUsersRow = {
        id: result.userId!,
        username: '',
        email: input.email,
        display_name: null,
        avatar_url: null,
        bio: null,
        timezone: 'UTC',
        language: 'en',
        status: UsersStatus.ACTIVE,
        email_verified: false,
        metadata: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return {
        user,
        session,
        accessToken: '',
        refreshToken: '',
        requiresMfa: true,
      };
    }

    const tokens = await this.tokenService.createTokenPair(result.userId!, result.sessionId);

    const session: IAuthSessionsRow = {
      id: result.sessionId!,
      user_id: result.userId!,
      token_hash: tokens.accessToken,
      refresh_token_hash: tokens.refreshToken,
      type: 'active',
      ip_address: input.ipAddress || null,
      user_agent: input.userAgent || null,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      refresh_expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      revoked_at: null,
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };

    const user: IUsersRow = {
      id: result.userId!,
      username: '',
      email: input.email,
      display_name: null,
      avatar_url: null,
      bio: null,
      timezone: 'UTC',
      language: 'en',
      status: UsersStatus.ACTIVE,
      email_verified: false,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return {
      user,
      session,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      requiresMfa: false,
    };
  }

  /**
   * Complete multi-factor authentication login process.
   * @param {string} sessionId - Session identifier.
   * @param {string} code - MFA verification code.
   * @returns {Promise<LoginResult>} Authentication result.
   */
  async completeMfaLogin(sessionId: string, code: string): Promise<LoginResult> {
    const userId = await this.authenticationService.validateSession(sessionId);

    if (!userId) {
      throw new Error('Invalid session');
    }

    const verified = await this.mfaService.verifyMFA({
      userId,
      code,
    });

    if (!verified) {
      throw new Error('Invalid MFA code');
    }

    const tokens = await this.tokenService.createTokenPair(userId, sessionId);

    const session: IAuthSessionsRow = {
      id: sessionId,
      user_id: userId,
      token_hash: tokens.accessToken,
      refresh_token_hash: tokens.refreshToken,
      type: 'active',
      ip_address: null,
      user_agent: null,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      refresh_expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      revoked_at: null,
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };

    const user: IUsersRow = {
      id: userId,
      username: '',
      email: '',
      display_name: null,
      avatar_url: null,
      bio: null,
      timezone: 'UTC',
      language: 'en',
      status: UsersStatus.ACTIVE,
      email_verified: false,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return {
      user,
      session,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      requiresMfa: false,
    };
  }

  /**
   * Logout user and invalidate session.
   * @param {string} sessionId - Session identifier to invalidate.
   * @returns {Promise<void>} Promise that resolves when logout is complete.
   */
  async logout(sessionId: string): Promise<void> {
    await this.authenticationService.revokeSession(sessionId);
  }

  /**
   * Refresh access token using refresh token.
   * @param {string} refreshToken - Valid refresh token.
   * @returns {Promise<{accessToken: string; refreshToken: string}>} New token pair.
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const validation = await this.tokenService.validateToken(refreshToken);

    if (!validation.valid || !validation.token || validation.token.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    const tokens = await this.tokenService.createTokenPair(
      validation.userId!,
      validation.token?.metadata?.sessionId as string | undefined,
    );

    await this.tokenService.revokeToken(validation.token.id);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }
}
