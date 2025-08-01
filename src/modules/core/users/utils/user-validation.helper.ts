/**
 * User validation helper utilities.
 * @file User validation helper.
 * @module users/utils
 */

import type {
 IUser, IUserCreateData, IUserUpdateData
} from '@/modules/core/users/types/users.module.generated';

/**
 * Validation helper for user operations.
 * This class contains only static methods for validating user data.
 */
export abstract class UserValidationHelper {
  /**
   * Validate user creation data.
   * @param data - User creation data to validate.
   * @throws Error if validation fails.
   */
  static validateUserData(data: IUserCreateData): void {
    if (!data.username || data.username.trim() === '') {
      throw new Error('Username is required');
    }

    if (!data.email || data.email.trim() === '') {
      throw new Error('Email is required');
    }

    if (data.username.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }

    if (data.username.length > 50) {
      throw new Error('Username must be less than 50 characters');
    }

    if (!(/^[a-zA-Z0-9_-]+$/u).test(data.username)) {
      throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
    }

    if (!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u).test(data.email)) {
      throw new Error('Invalid email format');
    }
  }

  /**
   * Validate user update data.
   * @param data - Update data to validate.
   * @param currentUser - Current user data (unused but kept for API compatibility).
   * @throws Error if validation fails.
   */
  static validateUpdateData(data: IUserUpdateData, currentUser: IUser): void {
    UserValidationHelper.validateUsernameField(data.username);

    UserValidationHelper.validateEmailField(data.email);

    UserValidationHelper.validateOptionalFields(data);

    void currentUser;
  }

  /**
   * Validate username field.
   * @param username - Username to validate.
   */
  private static validateUsernameField(username: string | undefined): void {
    if (username !== undefined) {
      if (!username || username.trim() === '') {
        throw new Error('Username cannot be empty');
      }

      if (username.length < 3) {
        throw new Error('Username must be at least 3 characters');
      }

      if (username.length > 50) {
        throw new Error('Username must be less than 50 characters');
      }

      if (!(/^[a-zA-Z0-9_-]+$/u).test(username)) {
        throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
      }
    }
  }

  /**
   * Validate email field.
   * @param email - Email to validate.
   */
  private static validateEmailField(email: string | undefined): void {
    if (email !== undefined) {
      if (!email || email.trim() === '') {
        throw new Error('Email cannot be empty');
      }

      if (!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u).test(email)) {
        throw new Error('Invalid email format');
      }
    }
  }

  /**
   * Validate optional user fields.
   * @param data - Update data to validate.
   */
  private static validateOptionalFields(data: IUserUpdateData): void {
    if (data.display_name !== undefined && data.display_name !== null && data.display_name.length > 0) {
      if (data.display_name.length > 100) {
        throw new Error('Display name must be less than 100 characters');
      }
    }

    if (data.bio !== undefined && data.bio !== null && data.bio.length > 0) {
      if (data.bio.length > 500) {
        throw new Error('Bio must be less than 500 characters');
      }
    }

    if (data.timezone !== undefined && data.timezone !== null && data.timezone.length > 0) {
      if (data.timezone.length > 50) {
        throw new Error('Timezone must be less than 50 characters');
      }
    }

    if (data.language !== undefined && data.language !== null && data.language.length > 0) {
      if (data.language.length > 10) {
        throw new Error('Language must be less than 10 characters');
      }
    }

    if (data.avatar_url !== undefined && data.avatar_url !== null && data.avatar_url.length > 0) {
      if (data.avatar_url.length > 500) {
        throw new Error('Avatar URL must be less than 500 characters');
      }

      try {
        new URL(data.avatar_url);
      } catch {
        throw new Error('Invalid avatar URL format');
      }
    }
  }
}
