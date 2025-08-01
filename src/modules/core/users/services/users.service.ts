/**
 * Users service for managing user operations.
 * @file Users service implementation.
 * @module users/services
 */

import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import type { IUsersRow } from '@/modules/core/users/types/database.generated';
import type {
  IUser,
  IUserCreateData,
  IUserUpdateData
} from '@/modules/core/users/types/users.module.generated';
import type {
  UserCreateOAuthRequestEvent,
  UserDataRequestEvent,
  UserDataResponseEvent
} from '@/modules/core/events/types/index';

import { UserEvents } from '@/modules/core/events/types/index';
import { UsersStatus } from '@/modules/core/users/types/database.generated';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { UsersRepository } from '@/modules/core/users/repositories/users.repository';
import { UserValidationHelper } from '@/modules/core/users/utils/user-validation.helper';
import { OAuthUserHelper } from '@/modules/core/users/utils/oauth-user.helper';

/**
 * Users service providing user management functionality.
 */
export class UsersService {
  private static instance: UsersService;
  private initialized = false;
  private logger?: ILogger;
  private readonly repository: UsersRepository;
  private readonly eventBus: EventBusService;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.repository = UsersRepository.getInstance();
    this.eventBus = EventBusService.getInstance();
  }

  /**
   * Get singleton instance.
   * @returns The users service instance.
   */
  static getInstance(): UsersService {
    UsersService.instance ||= new UsersService();
    return UsersService.instance;
  }

  /*
   * ============================================================================
   * PUBLIC METHODS
   * ============================================================================
   */

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

    this.repository.initialize();
    this.setupEventHandlers();
    this.initialized = true;
    this.logger?.info(LogSource.USERS, 'UsersService initialized');
  }

  /**
   * Create a new user.
   * @param data - User creation data.
   * @returns Promise resolving to created user.
   */
  public async createUser(data: IUserCreateData): Promise<IUser> {
    await this.ensureInitialized();
    await UserValidationHelper.validateUserData(data);

    const userData = this.buildUserForRepository(data);
    const user = await this.repository.createUser(userData as Omit<IUsersRow, 'id'> & { id: string });

    this.logger?.info(LogSource.USERS, `Created user: ${user.id}`);
    return user;
  }

  /**
   * Get user by ID.
   * @param id - User ID.
   * @returns Promise resolving to user or null if not found.
   */
  public async getUser(id: string): Promise<IUser | null> {
    await this.ensureInitialized();
    return await this.repository.findById(id);
  }

  /**
   * Get user by username.
   * @param username - Username to search for.
   * @returns Promise resolving to user or null if not found.
   */
  public async getUserByUsername(username: string): Promise<IUser | null> {
    await this.ensureInitialized();
    return await this.repository.findByUsername(username);
  }

  /**
   * Get user by email.
   * @param email - Email to search for.
   * @returns Promise resolving to user or null if not found.
   */
  public async getUserByEmail(email: string): Promise<IUser | null> {
    await this.ensureInitialized();
    return await this.repository.findByEmail(email);
  }

  /**
   * List all users.
   * @returns Promise resolving to array of users.
   */
  public async listUsers(): Promise<IUser[]> {
    await this.ensureInitialized();
    return await this.repository.findAll();
  }

  /**
   * Update user.
   * @param id - User ID to update.
   * @param data - Update data.
   * @returns Promise resolving to updated user.
   */
  public async updateUser(id: string, data: IUserUpdateData): Promise<IUser> {
    await this.ensureInitialized();

    const user = await this.repository.findById(id);
    if (!user) {
      throw new Error(`User not found: ${id}`);
    }

    await UserValidationHelper.validateUpdateData(data, user);
    const cleanData = this.buildCleanUpdateData(data);
    const updatedUser = await this.repository.updateUser(id, cleanData);

    this.emitUpdateEvents(user, updatedUser, data);
    this.logger?.info(LogSource.USERS, `Updated user: ${id}`);
    return updatedUser;
  }

  /**
   * Delete user.
   * @param id - User ID to delete.
   * @returns Promise that resolves when user is deleted.
   */
  public async deleteUser(id: string): Promise<void> {
    await this.ensureInitialized();

    const user = await this.repository.findById(id);
    if (!user) {
      throw new Error(`User not found: ${id}`);
    }

    await this.repository.deleteUser(id);
    this.logger?.info(LogSource.USERS, `Deleted user: ${id}`);
  }

  /**
   * Search users by query.
   * @param query - Search query.
   * @returns Promise resolving to matching users.
   */
  public async searchUsers(query: string): Promise<IUser[]> {
    await this.ensureInitialized();
    return await this.repository.searchUsers(query);
  }

  /*
   * ============================================================================
   * PRIVATE METHODS
   * ============================================================================
   */

  /**
   * Build user data for repository operations.
   * @param data - User creation data.
   * @returns Repository-compatible user data.
   */
  private buildUserForRepository(data: IUserCreateData): Partial<IUsersRow> {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      username: data.username,
      email: data.email,
      display_name: data.display_name ?? null,
      avatar_url: data.avatar_url ?? null,
      bio: data.bio ?? null,
      timezone: data.timezone ?? null,
      language: data.language ?? null,
      status: data.status,
      email_verified: data.email_verified ?? null,
      preferences: data.preferences ?? null,
      metadata: data.metadata ?? null,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * Build clean update data for repository.
   * @param data - The update data.
   * @returns Clean data for repository update.
   */
  private buildCleanUpdateData(
    data: IUserUpdateData
  ): Partial<Omit<IUsersRow, 'id' | 'created_at' | 'updated_at'>> {
    const cleanData = this.extractCleanFields(data);
    this.setUpdatedTimestamp(cleanData);
    return cleanData;
  }

  /**
   * Extract clean fields from update data.
   * @param data - Update data.
   * @returns Clean field data.
   */
  private extractCleanFields(data: IUserUpdateData): Record<string, unknown> {
    const cleanData: Record<string, unknown> = {};
    const fieldMappings = this.getUpdateFieldMappings();

    Object.entries(fieldMappings).forEach(([field, dbColumn]) => {
      if (data[field as keyof IUserUpdateData] !== undefined) {
        cleanData[dbColumn] = data[field as keyof IUserUpdateData];
      }
    });

    return cleanData;
  }

  /**
   * Get update field mappings.
   * @returns Mapping of data fields to database columns.
   */
  private getUpdateFieldMappings(): Record<string, string> {
    return {
      username: 'username',
      email: 'email',
      display_name: 'display_name',
      avatar_url: 'avatar_url',
      bio: 'bio',
      timezone: 'timezone',
      language: 'language',
      status: 'status',
      email_verified: 'email_verified',
      preferences: 'preferences',
      metadata: 'metadata'
    };
  }

  /**
   * Set updated timestamp on clean data.
   * @param cleanData - Clean data to modify.
   */
  private setUpdatedTimestamp(cleanData: Record<string, unknown>): void {
    cleanData.updated_at = new Date().toISOString();
  }

  /**
   * Emit update events for user changes.
   * @param originalUser - Original user data.
   * @param updatedUser - Updated user data.
   * @param updateData - The update data that was applied.
   */
  private emitUpdateEvents(
    originalUser: IUser,
    updatedUser: IUser,
    updateData: IUserUpdateData
  ): void {
    this.eventBus.emit('user:updated', {
      userId: updatedUser.id,
      changes: updateData,
      before: originalUser,
      after: updatedUser
    });
  }

  /**
   * Setup event handlers for user operations.
   */
  private setupEventHandlers(): void {
    this.setupUserDataRequestHandler();
    this.setupOAuthUserCreationHandler();
  }

  /**
   * Setup user data request handler.
   */
  private setupUserDataRequestHandler(): void {
    this.eventBus.on<UserDataRequestEvent>(
      'USER_DATA_REQUEST',
      async (data: unknown) => {
        const event = data as UserDataRequestEvent;
        try {
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
          this.handleUserDataRequestError(event, error);
        }
      }
    );
  }

  /**
   * Setup OAuth user creation handler.
   */
  private setupOAuthUserCreationHandler(): void {
    this.eventBus.on<UserCreateOAuthRequestEvent>(
      'USER_CREATE_OAUTH_REQUEST',
      async (data: unknown) => {
        const event = data as UserCreateOAuthRequestEvent;
        try {
          const user = await this.findOrCreateOAuthUser(event);
          const response = OAuthUserHelper.buildOAuthSuccessResponse(event.requestId, user);
          this.eventBus.emit('USER_CREATE_OAUTH_RESPONSE', response);
        } catch (error) {
          const errorResponse = OAuthUserHelper.buildOAuthErrorResponse(event.requestId, error);
          this.eventBus.emit('USER_CREATE_OAUTH_RESPONSE', errorResponse);
        }
      }
    );
  }

  /**
   * Find user from request data.
   * @param event - User data request event.
   * @returns Promise resolving to user or null.
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
   * Find or create OAuth user.
   * @param event - OAuth user creation request.
   * @returns Promise resolving to user.
   */
  private async findOrCreateOAuthUser(event: UserCreateOAuthRequestEvent): Promise<IUser> {
    const existingUser = await this.getUserByEmail(event.email);
    if (existingUser) {
      return existingUser;
    }

    const username = await OAuthUserHelper.generateUniqueUsername(
      event,
      async (testUsername: string): Promise<boolean> => {
        const user = await this.getUserByUsername(testUsername);
        return user !== null;
      }
    );

    return await this.createUser({
      username,
      email: event.email,
      display_name: event.name ?? null,
      avatar_url: event.avatar ?? null,
      bio: null,
      timezone: null,
      language: null,
      status: UsersStatus.ACTIVE,
      email_verified: true,
      preferences: null,
      metadata: null
    });
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
