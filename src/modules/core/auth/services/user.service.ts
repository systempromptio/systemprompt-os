/**
 * User management service with proper role assignment.
 * @module modules/core/auth/services/user.service
 */

import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { UserRepository } from '@/modules/core/auth/repositories/user.repository';
import type {
  ICreateUserOptions,
  IDatabaseConnection,
  IUserWithRoles,
} from '@/modules/core/auth/types/user-service.types';

/**
 * UserService class for managing users and authentication.
 */
export class UserService {
  private static instance: UserService | undefined;
  private readonly logger!: ILogger;
  private readonly userRepository: UserRepository;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.userRepository = UserRepository.getInstance();
  }

  /**
   * Get singleton instance of UserService.
   * @returns UserService instance.
   */
  public static getInstance(): UserService {
    UserService.instance ??= new UserService();
    return UserService.instance;
  }

  /**
   * Check if any admin users exist in the system.
   * This is checked BEFORE any user creation to avoid race conditions.
   * @returns Promise resolving to boolean indicating admin presence.
   */
  async hasAdminUsers(): Promise<boolean> {
    return await this.userRepository.hasAdminUsers();
  }

  /**
   * Create or update a user from OAuth login.
   * Handles first-user admin assignment properly.
   * @param options - User creation/update options.
   * @returns Promise resolving to user with roles.
   */
  async createOrUpdateUserFromOauth(options: ICreateUserOptions): Promise<IUserWithRoles> {
    const {
      provider,
      providerId,
      email,
      name,
      avatar,
    } = options;

    const hasAdmins = await this.hasAdminUsers();
    this.logger.info(LogSource.AUTH, 'Creating/updating user', {
      email,
      hasAdmins,
    });

    return await this.userRepository.performTransaction<IUserWithRoles>(
      async (connection: IDatabaseConnection): Promise<IUserWithRoles> => {
      const existingUserId = await this.userRepository.findOAuthIdentity(
        provider,
        providerId,
        connection,
      );

      let userId: string;

      if (existingUserId === null) {
        userId = await this.createNewUserFromOauth(options, hasAdmins, connection);
        this.logger.info(LogSource.AUTH, 'Created new user with role', {
          userId,
          email,
          role: hasAdmins ? 'user' : 'admin',
        });
      } else {
        userId = existingUserId;
        await this.userRepository.updateUser(userId, name, avatar, connection);
        this.logger.info(LogSource.AUTH, 'Updated existing user', {
          userId,
          email,
        });
      }

      const user = await this.userRepository.getUserByIdWithConnection(userId, connection);
      if (user === null) {
        throw new Error('User creation/update failed');
      }

      return user;
    },
    );
  }

  /**
   * Get user by ID with roles.
   * @param userId - User ID to retrieve.
   * @returns Promise resolving to user with roles or null.
   */
  async getUserById(userId: string): Promise<IUserWithRoles | null> {
    return await this.userRepository.getUserById(userId);
  }

  /**
   * Get user by email.
   * @param email - User email to search for.
   * @returns Promise resolving to user with roles or null.
   */
  async getUserByEmail(email: string): Promise<IUserWithRoles | null> {
    return await this.userRepository.getUserByEmail(email);
  }

  /**
   * Create a new user from OAuth provider data.
   * @param options - User creation options.
   * @param hasAdmins - Whether admin users already exist.
   * @param connection - Database connection for transaction.
   * @returns Promise resolving to created user ID.
   */
  private async createNewUserFromOauth(
    options: ICreateUserOptions,
    hasAdmins: boolean,
    connection: IDatabaseConnection,
  ): Promise<string> {
    return await this.userRepository.createUserWithOAuthIdentity(options, hasAdmins, connection);
  }
}
