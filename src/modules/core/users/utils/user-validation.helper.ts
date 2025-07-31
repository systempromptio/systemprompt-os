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
 */
export class UserValidationHelper {
  /**
   * Validate user creation data.
   * @param data - User creation data to validate.
   * @throws Error if validation fails.
   */
  static async validateUserData(data: IUserCreateData): Promise<void> {
    if (!data.username?.trim()) {
      throw new Error('Username is required');
    }

    if (!data.email?.trim()) {
      throw new Error('Email is required');
    }

    if (data.username.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }

    if (data.username.length > 50) {
      throw new Error('Username must be less than 50 characters');
    }

    if (!(/^[a-zA-Z0-9_-]+$/).test(data.username)) {
      throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
    }

    if (!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(data.email)) {
      throw new Error('Invalid email format');
    }
  }

  /**
   * Validate user update data.
   * @param data - Update data to validate.
   * @param currentUser - Current user data.
   * @param _currentUser
   * @throws Error if validation fails.
   */
  static async validateUpdateData(data: IUserUpdateData, _currentUser: IUser): Promise<void> {
    if (data.username !== undefined) {
      if (!data.username?.trim()) {
        throw new Error('Username cannot be empty');
      }

      if (data.username.length < 3) {
        throw new Error('Username must be at least 3 characters');
      }

      if (data.username.length > 50) {
        throw new Error('Username must be less than 50 characters');
      }

      if (!(/^[a-zA-Z0-9_-]+$/).test(data.username)) {
        throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
      }
    }

    if (data.email !== undefined) {
      if (!data.email?.trim()) {
        throw new Error('Email cannot be empty');
      }

      if (!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(data.email)) {
        throw new Error('Invalid email format');
      }
    }

    if (data.display_name !== undefined && data.display_name !== null) {
      if (data.display_name.length > 100) {
        throw new Error('Display name must be less than 100 characters');
      }
    }

    if (data.bio !== undefined && data.bio !== null) {
      if (data.bio.length > 500) {
        throw new Error('Bio must be less than 500 characters');
      }
    }

    if (data.timezone !== undefined && data.timezone !== null) {
      if (data.timezone.length > 50) {
        throw new Error('Timezone must be less than 50 characters');
      }
    }

    if (data.language !== undefined && data.language !== null) {
      if (data.language.length > 10) {
        throw new Error('Language must be less than 10 characters');
      }
    }

    if (data.avatar_url !== undefined && data.avatar_url !== null) {
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
