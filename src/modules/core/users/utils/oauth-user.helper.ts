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
 * User data response interface.
 */
interface UserDataResponse {
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
}

/**
 * Helper for OAuth user operations.
 * This class contains only static methods for OAuth operations.
 */
export abstract class OAuthUserHelper {
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
        ...user.avatar_url && user.avatar_url.length > 0 ? { avatarUrl: user.avatar_url } : {},
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
    const baseUsername = OAuthUserHelper.extractBaseUsername(event);
    return await OAuthUserHelper.findAvailableUsername(baseUsername, isUsernameTaken);
  }

  /**
   * Extract base username from OAuth event.
   * @param event - OAuth request event.
   * @returns Base username.
   */
  private static extractBaseUsername(event: UserCreateOAuthRequestEvent): string {
    const nameUsername = event.name?.toLowerCase().replace(/\s+/gu, '') ?? '';
    const emailUsername = event.email?.split('@')[0]?.toLowerCase() ?? '';

    return nameUsername.length > 0 ? nameUsername
           : emailUsername.length > 0 ? emailUsername : 'user';
  }

  /**
   * Find available username by incrementing counter.
   * @param baseUsername - Base username to start with.
   * @param isUsernameTaken - Function to check if username is taken.
   * @returns Promise resolving to available username.
   */
  private static async findAvailableUsername(
    baseUsername: string,
    isUsernameTaken: (username: string) => Promise<boolean>
  ): Promise<string> {
    let username = baseUsername;
    let counter = 1;

    while (await isUsernameTaken(username)) {
      username = `${baseUsername}${String(counter)}`;
      counter += 1;
    }

    return username;
  }

  /**
   * Build user data response.
   * @param user - User data.
   * @returns Formatted user data response.
   */
  static buildUserDataResponse(user: IUser): UserDataResponse {
    const baseResponse = OAuthUserHelper.buildBaseResponse(user);
    const optionalFields = OAuthUserHelper.buildOptionalFields(user);

    return {
 ...baseResponse,
...optionalFields
};
  }

  /**
   * Build base response fields.
   * @param user - User data.
   * @returns Base response fields.
   */
  private static buildBaseResponse(user: IUser): Pick<UserDataResponse, 'id' | 'username' | 'email' | 'status' | 'createdAt' | 'updatedAt'> {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      status: user.status,
      createdAt: user.created_at ?? '',
      updatedAt: user.updated_at ?? ''
    };
  }

  /**
   * Build optional response fields.
   * @param user - User data.
   * @returns Optional response fields.
   */
  private static buildOptionalFields(user: IUser): Partial<UserDataResponse> {
    const optionalFields: Partial<UserDataResponse> = {};

    if (user.display_name && user.display_name.length > 0) {
      optionalFields.displayName = user.display_name;
    }

    if (user.avatar_url && user.avatar_url.length > 0) {
      optionalFields.avatarUrl = user.avatar_url;
    }

    if (user.bio && user.bio.length > 0) {
      optionalFields.bio = user.bio;
    }

    if (user.timezone && user.timezone.length > 0) {
      optionalFields.timezone = user.timezone;
    }

    if (user.language && user.language.length > 0) {
      optionalFields.language = user.language;
    }

    if (user.email_verified !== null) {
      optionalFields.emailVerified = Boolean(user.email_verified);
    }

    if (user.preferences && user.preferences.length > 0) {
      try {
        optionalFields.preferences = JSON.parse(user.preferences) as Record<string, unknown>;
      } catch {
      }
    }

    if (user.metadata && user.metadata.length > 0) {
      try {
        optionalFields.metadata = JSON.parse(user.metadata) as Record<string, unknown>;
      } catch {
      }
    }

    return optionalFields;
  }
}
