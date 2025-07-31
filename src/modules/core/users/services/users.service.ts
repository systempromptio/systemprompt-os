/**
 * Users service implementation - manages user profiles and data.
 * @file Users service implementation.
 * @module users/services
 * Provides business logic for user management operations.
 * Authentication concerns have been moved to the auth module.
 */

import { randomUUID } from 'crypto';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { UsersRepository } from '@/modules/core/users/repositories/users.repository';
import {
  type IUser,
  type IUserCreateData,
  type IUserUpdateData
} from '@/modules/core/users/types/users.module.generated';
import type { IUsersService } from '@/modules/core/users/types/users.service.generated';
import { type IUsersRow, UsersStatus } from '@/modules/core/users/types/database.generated';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import {
  type UserCreateOAuthRequestEvent,
  type UserCreatedEvent,
  type UserDataRequestEvent,
  type UserDataResponseEvent,
  type UserDeletedEvent,
  UserEvents,
  type UserUpdatedEvent
} from '@/modules/core/events/types/index';
import { UserValidationHelper } from '@/modules/core/users/utils/user-validation.helper';
import { OAuthUserHelper } from '@/modules/core/users/utils/oauth-user.helper';

/**
 * Service for managing users.
 */
export class UsersService implements IUsersService {
  private static instance: UsersService;
  private readonly repository: UsersRepository;
  private readonly eventBus: EventBusService;
  private logger?: ILogger;
  private initialized = false;

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    this.repository = UsersRepository.getInstance();
    this.eventBus = EventBusService.getInstance();
    this.setupEventHandlers();
  }

  /**
   * Get singleton instance.
   * @returns The users service instance.
   */
  static getInstance(): UsersService {
    UsersService.instance ||= new UsersService();
    return UsersService.instance;
  }

  /**
   * Set logger instance.
   * @param logger - The logger instance to use.
   */
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * Initialize service.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.repository.initialize();
    this.initialized = true;
    this.logger?.info(LogSource.USERS, 'UsersService initialized');
  }

  /**
   * Build user data for repository creation.
   * @param data - User creation data.
   * @param id - Generated user ID.
   * @param now - Current timestamp.
   * @returns Repository user data.
   */
  private buildUserForRepository(
    data: IUserCreateData,
    id: string,
    now: Date
  ): Omit<IUsersRow, 'id'> & { id: string } {
    return {
      id,
      username: data.username,
      email: data.email,
      display_name: data.display_name ?? null,
      avatar_url: data.avatar_url ?? null,
      bio: data.bio ?? null,
      timezone: data.timezone ?? 'UTC',
      language: data.language ?? 'en',
      status: UsersStatus.ACTIVE,
      email_verified: data.email_verified ?? false,
      preferences: data.preferences ?? null,
      metadata: data.metadata ?? null,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };
  }

  /**
   * Create a new user.
   * @param data - The user creation data.
   * @returns Promise that resolves to the created user.
   */
  public async createUser(data: IUserCreateData): Promise<IUser> {
    await this.ensureInitialized();
    await UserValidationHelper.validateUserData(data);
    await this.validateUserData(data);

    const id = randomUUID();
    const now = new Date();

    this.logger?.info(LogSource.USERS, `Creating user: ${data.username}`);

    const userData = this.buildUserForRepository(data, id, now);
    const user = await this.repository.createUser(userData);

    const event: UserCreatedEvent = {
      userId: user.id,
      username: user.username,
      email: user.email,
      timestamp: now
    };
    this.eventBus.emit(UserEvents.USER_CREATED, event);

    this.logger?.info(LogSource.USERS, `Created user: ${id}`);
    return user;
  }

  /**
   * Validate user creation data.
   * @param data - The user creation data.
   * @returns Promise that resolves when validation passes.
   */
  private async validateUserData(data: IUserCreateData): Promise<void> {
    const existingUsername = await this.repository.findByUsername(data.username);
    if (existingUsername !== null) {
      throw new Error(`Username already exists: ${data.username}`);
    }

    const existingEmail = await this.repository.findByEmail(data.email);
    if (existingEmail !== null) {
      throw new Error(`Email already exists: ${data.email}`);
    }
  }

  /**
   * Get user by ID.
   * @param id - The user ID.
   * @returns Promise that resolves to the user or null if not found.
   */
  public async getUser(id: string): Promise<IUser | null> {
    await this.ensureInitialized();
    return await this.repository.findById(id);
  }

  /**
   * Get user by username.
   * @param username - The username.
   * @returns Promise that resolves to the user or null if not found.
   */
  public async getUserByUsername(username: string): Promise<IUser | null> {
    await this.ensureInitialized();
    return await this.repository.findByUsername(username);
  }

  /**
   * Get user by email.
   * @param email - The email address.
   * @returns Promise that resolves to the user or null if not found.
   */
  public async getUserByEmail(email: string): Promise<IUser | null> {
    await this.ensureInitialized();
    return await this.repository.findByEmail(email);
  }

  /**
   * List all users.
   * @returns Promise that resolves to array of users.
   */
  public async listUsers(): Promise<IUser[]> {
    await this.ensureInitialized();
    return await this.repository.findAll();
  }

  /**
   * Update user information.
   * @param id - The user ID.
   * @param data - The update data.
   * @returns Promise that resolves to the updated user.
   */
  public async updateUser(id: string, data: IUserUpdateData): Promise<IUser> {
    await this.ensureInitialized();

    const user = await this.repository.findById(id);
    if (user === null) {
      throw new Error(`User not found: ${id}`);
    }

    await UserValidationHelper.validateUpdateData(data, user);

    this.logger?.info(LogSource.USERS, `Updating user: ${id}`);

    const cleanData = this.buildCleanUpdateData(data);
    const updatedUser = await this.repository.updateUser(id, cleanData);

    await this.emitUpdateEvents(user, updatedUser, data);

    this.logger?.info(LogSource.USERS, `Updated user: ${id}`);
    return updatedUser;
  }

  /**
   * Build clean update data for repository.
   * @param data - The update data.
   * @returns Clean data for repository update.
   */
  private buildCleanUpdateData(
    data: IUserUpdateData
  ): Partial<Omit<IUsersRow, 'id' | 'created_at' | 'updated_at'>> {
    const cleanData: Record<string, unknown> = {};
    const {
      username,
      email,
      display_name,
      avatar_url,
      bio,
      timezone,
      language,
      status,
      email_verified,
      preferences,
      metadata
    } = data;

    if (username !== undefined) { cleanData.username = username; }
    if (email !== undefined) { cleanData.email = email; }
    if (display_name !== undefined) { cleanData.display_name = display_name; }
    if (avatar_url !== undefined) { cleanData.avatar_url = avatar_url; }
    if (bio !== undefined) { cleanData.bio = bio; }
    if (timezone !== undefined) { cleanData.timezone = timezone; }
    if (language !== undefined) { cleanData.language = language; }
    if (status !== undefined) { cleanData.status = status; }
    if (email_verified !== undefined) { cleanData.email_verified = email_verified; }
    if (preferences !== undefined) { cleanData.preferences = preferences; }
    if (metadata !== undefined) { cleanData.metadata = metadata; }

    return cleanData as Partial<Omit<IUsersRow, 'id' | 'created_at' | 'updated_at'>>;
  }

  /**
   * Emit update-related events.
   * @param originalUser - The original user before update.
   * @param updatedUser - The updated user.
   * @param data - The update data.
   * @returns Promise that resolves when events are emitted.
   */
  private emitUpdateEvents(
    originalUser: IUser,
    updatedUser: IUser,
    data: IUserUpdateData
  ): void {
    const event: UserUpdatedEvent = {
      userId: updatedUser.id,
      changes: data as Record<string, unknown>,
      timestamp: new Date()
    };
    this.eventBus.emit(UserEvents.USER_UPDATED, event);

    if (data.status !== undefined && data.status !== originalUser.status) {
      this.eventBus.emit(UserEvents.USER_STATUS_CHANGED, {
        userId: originalUser.id,
        oldStatus: originalUser.status,
        newStatus: data.status,
        timestamp: new Date()
      });
    }
  }

  /**
   * Delete a user.
   * @param id - The user ID.
   * @returns Promise that resolves when deleted.
   */
  public async deleteUser(id: string): Promise<void> {
    await this.ensureInitialized();

    const user = await this.repository.findById(id);
    if (user === null) {
      throw new Error(`User not found: ${id}`);
    }

    this.logger?.info(LogSource.USERS, `Deleting user: ${id}`);
    await this.repository.deleteUser(id);

    const event: UserDeletedEvent = {
      userId: id,
      timestamp: new Date()
    };
    this.eventBus.emit(UserEvents.USER_DELETED, event);

    this.logger?.info(LogSource.USERS, `Deleted user: ${id}`);
  }

  /**
   * Search users by query.
   * @param query - The search query.
   * @returns Promise that resolves to array of matching users.
   */
  public async searchUsers(query: string): Promise<IUser[]> {
    await this.ensureInitialized();
    return await this.repository.searchUsers(query);
  }

  /**
   * Setup event handlers for auth module communication.
   */
  private setupEventHandlers(): void {
    this.setupUserDataRequestHandler();
    this.setupOAuthUserCreationHandler();
  }

  /**
   * Setup handler for user data requests.
   */
  private setupUserDataRequestHandler(): void {
    this.eventBus.on<UserDataRequestEvent>(
      UserEvents.USER_DATA_REQUEST,
      async (data: unknown): Promise<void> => {
        try {
          const event = data as UserDataRequestEvent;
          const user = await this.findUserFromRequest(event);

          const response: UserDataResponseEvent = {
            requestId: event.requestId,
            user: user ? {
              id: user.id,
              username: user.username,
              email: user.email,
              status: user.status,
              emailVerified: user.email_verified || false
            } : null
          };

          this.eventBus.emit(UserEvents.USER_DATA_RESPONSE, response);
        } catch (error) {
          this.handleUserDataRequestError(data as UserDataRequestEvent, error);
        }
      }
    );
  }

  /**
   * Find user from request data.
   * @param event - The user data request event.
   * @returns Promise that resolves to user or null.
   */
  private async findUserFromRequest(event: UserDataRequestEvent): Promise<IUser | null> {
    if (event.userId && event.userId.length > 0) {
      return await this.getUser(event.userId);
    }
    if (event.username && event.username.length > 0) {
      return await this.getUserByUsername(event.username);
    }
    if (event.email && event.email.length > 0) {
      return await this.getUserByEmail(event.email);
    }
    return null;
  }

  /**
   * Handle user data request error.
   * @param event - The original request event.
   * @param error - The error that occurred.
   */
  private handleUserDataRequestError(event: UserDataRequestEvent, error: unknown): void {
    this.logger?.error(LogSource.USERS, 'Error handling user data request', {
      error: error instanceof Error ? error.message : String(error)
    });

    const response: UserDataResponseEvent = {
      requestId: event.requestId,
      user: null
    };
    this.eventBus.emit(UserEvents.USER_DATA_RESPONSE, response);
  }

  /**
   * Setup handler for OAuth user creation.
   */
  private setupOAuthUserCreationHandler(): void {
    this.eventBus.on<UserCreateOAuthRequestEvent>(
      UserEvents.USER_CREATE_OAUTH_REQUEST,
      async (data: unknown): Promise<void> => {
        try {
          const event = data as UserCreateOAuthRequestEvent;
          const user = await this.findOrCreateOAuthUser(event);
          const response = OAuthUserHelper.buildOAuthSuccessResponse(event.requestId, user);
          this.eventBus.emit(UserEvents.USER_CREATE_OAUTH_RESPONSE, response);
        } catch (error) {
          this.logger?.error(LogSource.USERS, 'Error handling OAuth user creation', {
          error: error instanceof Error ? error.message : String(error)
        });
        const event = data as UserCreateOAuthRequestEvent;
        const response = OAuthUserHelper.buildOAuthErrorResponse(event.requestId, error);
        this.eventBus.emit(UserEvents.USER_CREATE_OAUTH_RESPONSE, response);
        }
      }
    );
  }

  /**
   * Find or create OAuth user.
   * @param event - The OAuth user creation request.
   * @returns Promise that resolves to the user.
   */
  private async findOrCreateOAuthUser(event: UserCreateOAuthRequestEvent): Promise<IUser> {
    let user = await this.getUserByEmail(event.email);

    if (user === null) {
      const username = await OAuthUserHelper.generateUniqueUsername(
        event,
        async (username: string) => {
          const existing = await this.repository.findByUsername(username);
          return existing !== null;
        }
      );
      user = await this.createUser({
        username,
        email: event.email,
        display_name: event.name ?? username,
        avatar_url: event.avatar ?? null,
        bio: null,
        timezone: 'UTC',
        language: 'en',
        status: UsersStatus.ACTIVE,
        email_verified: true,
        preferences: null,
        metadata: null
      });
    }

    return user;
  }

  /**
   * Ensure service is initialized.
   * @returns Promise that resolves when initialized.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
