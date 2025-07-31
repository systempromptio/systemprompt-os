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
import { UsersStatus } from '@/modules/core/users/types/database.generated';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import {
  type UserCreateOAuthRequestEvent,
  type UserCreateOAuthResponseEvent,
  type UserCreatedEvent,
  type UserDataRequestEvent,
  type UserDataResponseEvent,
  type UserDeletedEvent,
  UserEvents,
  type UserUpdatedEvent
} from '@/modules/core/events/types/index';

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
   * Create a new user.
   * @param data - The user creation data.
   * @returns Promise that resolves to the created user.
   */
  async createUser(data: IUserCreateData): Promise<IUser> {
    await this.ensureInitialized();
    await this.validateUserData(data);

    const id = randomUUID();
    const now = new Date();

    this.logger?.info(LogSource.USERS, `Creating user: ${data.username}`);

    const user = await this.repository.createUser({
      id,
      username: data.username,
      email: data.email,
      display_name: data.display_name || null,
      avatar_url: data.avatar_url || null,
      bio: data.bio || '',
      timezone: data.timezone ?? 'UTC',
      language: data.language ?? 'en',
      status: UsersStatus.ACTIVE,
      email_verified: data.email_verified ?? false,
      preferences: data.preferences || null,
      metadata: data.metadata || null,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    });

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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
    if (!emailRegex.test(data.email)) {
      throw new Error(`Invalid email format: ${data.email}`);
    }

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
  async getUser(id: string): Promise<IUser | null> {
    await this.ensureInitialized();
    return await this.repository.findById(id);
  }

  /**
   * Get user by username.
   * @param username - The username.
   * @returns Promise that resolves to the user or null if not found.
   */
  async getUserByUsername(username: string): Promise<IUser | null> {
    await this.ensureInitialized();
    return await this.repository.findByUsername(username);
  }

  /**
   * Get user by email.
   * @param email - The email address.
   * @returns Promise that resolves to the user or null if not found.
   */
  async getUserByEmail(email: string): Promise<IUser | null> {
    await this.ensureInitialized();
    return await this.repository.findByEmail(email);
  }

  /**
   * List all users.
   * @returns Promise that resolves to array of users.
   */
  async listUsers(): Promise<IUser[]> {
    await this.ensureInitialized();
    return await this.repository.findAll();
  }

  /**
   * Update user information.
   * @param id - The user ID.
   * @param data - The update data.
   * @returns Promise that resolves to the updated user.
   */
  async updateUser(id: string, data: IUserUpdateData): Promise<IUser> {
    await this.ensureInitialized();

    const user = await this.repository.findById(id);
    if (user === null) {
      throw new Error(`User not found: ${id}`);
    }

    if (data.email !== undefined && data.email !== user.email) {
      const existingEmail = await this.repository.findByEmail(data.email);
      if (existingEmail !== null) {
        throw new Error(`Email already exists: ${data.email}`);
      }
    }

    if (data.username !== undefined && data.username !== user.username) {
      const existingUsername = await this.repository.findByUsername(data.username);
      if (existingUsername !== null) {
        throw new Error(`Username already exists: ${data.username}`);
      }
    }

    this.logger?.info(LogSource.USERS, `Updating user: ${id}`);

    const cleanData: Record<string, any> = {};
    if (data.username !== undefined) { cleanData.username = data.username; }
    if (data.email !== undefined) { cleanData.email = data.email; }
    if (data.display_name !== undefined) { cleanData.display_name = data.display_name; }
    if (data.avatar_url !== undefined) { cleanData.avatar_url = data.avatar_url; }
    if (data.bio !== undefined) { cleanData.bio = data.bio; }
    if (data.timezone !== undefined) { cleanData.timezone = data.timezone; }
    if (data.language !== undefined) { cleanData.language = data.language; }
    if (data.status !== undefined) { cleanData.status = data.status; }
    if (data.email_verified !== undefined) { cleanData.email_verified = data.email_verified; }
    if (data.preferences !== undefined) { cleanData.preferences = data.preferences; }
    if (data.metadata !== undefined) { cleanData.metadata = data.metadata; }

    const updatedUser = await this.repository.updateUser(id, cleanData as Partial<Omit<import('@/modules/core/users/types/database.generated').IUsersRow, 'id' | 'created_at' | 'updated_at'>>);

    const event: UserUpdatedEvent = {
      userId: updatedUser.id,
      changes: data as Record<string, unknown>,
      timestamp: new Date()
    };
    this.eventBus.emit(UserEvents.USER_UPDATED, event);

    if (data.status !== undefined && data.status !== user.status) {
      this.eventBus.emit(UserEvents.USER_STATUS_CHANGED, {
        userId: user.id,
        oldStatus: user.status,
        newStatus: data.status,
        timestamp: new Date()
      });
    }

    this.logger?.info(LogSource.USERS, `Updated user: ${id}`);
    return updatedUser;
  }

  /**
   * Delete a user.
   * @param id - The user ID.
   * @returns Promise that resolves when deleted.
   */
  async deleteUser(id: string): Promise<void> {
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
  async searchUsers(query: string): Promise<IUser[]> {
    await this.ensureInitialized();
    return await this.repository.searchUsers(query);
  }

  /**
   * Setup event handlers for auth module communication.
   */
  private setupEventHandlers(): void {
    this.eventBus.on<UserDataRequestEvent>(UserEvents.USER_DATA_REQUEST, async (data: unknown) => {
      try {
        const event = data as UserDataRequestEvent;
        let user: IUser | null = null;

        if (event.userId) {
          user = await this.getUser(event.userId);
        } else if (event.username) {
          user = await this.getUserByUsername(event.username);
        } else if (event.email) {
          user = await this.getUserByEmail(event.email);
        }

        const response: UserDataResponseEvent = {
          requestId: event.requestId,
          user: user ? {
            id: user.id,
            username: user.username,
            email: user.email,
            status: user.status as string,
            emailVerified: user.email_verified ?? false
          } : null
        };

        this.eventBus.emit(UserEvents.USER_DATA_RESPONSE, response);
      } catch (error) {
        this.logger?.error(LogSource.USERS, 'Error handling user data request', { error: error instanceof Error ? error.message : String(error) });

        const response: UserDataResponseEvent = {
          requestId: (data as UserDataRequestEvent).requestId,
          user: null
        };
        this.eventBus.emit(UserEvents.USER_DATA_RESPONSE, response);
      }
    });

    this.eventBus.on<UserCreateOAuthRequestEvent>(UserEvents.USER_CREATE_OAUTH_REQUEST, async (data: unknown) => {
      try {
        const event = data as UserCreateOAuthRequestEvent;

        let user = await this.getUserByEmail(event.email);

        if (!user) {
          const baseUsername = event.name?.toLowerCase().replace(/\s+/g, '')
                            || event.email?.split('@')[0]?.toLowerCase() || 'user';
          let username = baseUsername;
          let counter = 1;

          while (await this.getUserByUsername(username)) {
            username = `${baseUsername}${counter}`;
            counter++;
          }

          user = await this.createUser({
            username,
            email: event.email,
            display_name: event.name || username,
            avatar_url: event.avatar || null,
            bio: null,
            timezone: 'UTC',
            language: 'en',
            status: UsersStatus.ACTIVE,
            email_verified: true,
            preferences: null,
            metadata: null
          });
        }

        const response: UserCreateOAuthResponseEvent = {
          requestId: event.requestId,
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            ...user.avatar_url && { avatarUrl: user.avatar_url },
            roles: []
          }
        };

        this.eventBus.emit(UserEvents.USER_CREATE_OAUTH_RESPONSE, response);
      } catch (error) {
        this.logger?.error(LogSource.USERS, 'Error handling OAuth user creation', {
          error: error instanceof Error ? error.message : String(error)
        });

        const response: UserCreateOAuthResponseEvent = {
          requestId: (data as UserCreateOAuthRequestEvent).requestId,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create OAuth user'
        };

        this.eventBus.emit(UserEvents.USER_CREATE_OAUTH_RESPONSE, response);
      }
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
