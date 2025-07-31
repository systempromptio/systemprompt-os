/**
 * OAuth user helper utilities.
 * @file OAuth user helper.
 * @module users/utils
 */

import type { IUser } from '@/modules/core/users/types/users.module.generated';
import {
  type UserCreateOAuthRequestEvent,
  type UserCreateOAuthResponseEvent
} from '@/modules/core/events/types/index';

/**
 * Helper for OAuth user operations.
 */
export class OAuthUserHelper {
  /**
   * Build OAuth success response.
   * @param requestId - The request ID.
   * @param user - The user data.
   * @returns OAuth success response.
   */
  static buildOAuthSuccessResponse(requestId: string, user: IUser): UserCreateOAuthResponseEvent {
    return {
      requestId,
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        ...user.avatar_url && user.avatar_url.length > 0 && { avatarUrl: user.avatar_url },
        roles: []
      }
    };
  }

  /**
   * Build OAuth error response.
   * @param requestId - The request ID.
   * @param error - The error that occurred.
   * @returns OAuth error response.
   */
  static buildOAuthErrorResponse(requestId: string, error: unknown): UserCreateOAuthResponseEvent {
    return {
      requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create OAuth user'
    };
  }

  /**
   * Generate unique username from OAuth data.
   * @param event - OAuth request event.
   * @param isUsernameTaken - Function to check if username is taken.
   * @returns Promise resolving to unique username.
   */
  static async generateUniqueUsername(
    event: UserCreateOAuthRequestEvent,
    isUsernameTaken: (username: string) => Promise<boolean>
  ): Promise<string> {
    const baseUsername = (event.name?.toLowerCase().replace(/\s+/gu, '') ?? '')
                      || (event.email?.split('@')[0]?.toLowerCase() ?? '') || 'user';
    let username = baseUsername;
    let counter = 1;

    while (await isUsernameTaken(username)) {
      username = `${baseUsername}${counter}`;
      counter += 1;
    }

    return username;
  }

  /**
   * Build user data response.
   * @param user - User data.
   * @returns Formatted user data response.
   */
  static buildUserDataResponse(user: IUser): {
    id: string;
    username: string;
    email: string;
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
    timezone?: string;
    language?: string;
    status: string;
    emailVerified?: boolean;
    preferences?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  } {
    const result: any = {
      id: user.id,
      username: user.username,
      email: user.email,
      status: user.status,
      createdAt: user.created_at || '',
      updatedAt: user.updated_at || ''
    };

    if (user.display_name && user.display_name.length > 0) {
      result.displayName = user.display_name;
    }
    if (user.avatar_url && user.avatar_url.length > 0) {
      result.avatarUrl = user.avatar_url;
    }
    if (user.bio && user.bio.length > 0) {
      result.bio = user.bio;
    }
    if (user.timezone && user.timezone.length > 0) {
      result.timezone = user.timezone;
    }
    if (user.language && user.language.length > 0) {
      result.language = user.language;
    }
    if (user.email_verified !== null) {
      result.emailVerified = Boolean(user.email_verified);
    }
    if (user.preferences) {
      result.preferences = JSON.parse(user.preferences);
    }
    if (user.metadata) {
      result.metadata = JSON.parse(user.metadata);
    }

    return result;
  }
}
