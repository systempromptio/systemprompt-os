/**
 * User event service for handling user operations via the event bus.
 * This replaces direct user service calls with event-based communication.
 * @module modules/core/auth/services/user-event.service
 */

import { randomUUID } from 'crypto';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { LogSource, getLoggerService } from '@/modules/core/logger/index';
import { type ILogger } from '@/modules/core/logger/types/index';
import {
  UserEvents,
  type UserCreateOAuthRequestEvent,
  type UserCreateOAuthResponseEvent,
  type UserDataRequestEvent,
  type UserDataResponseEvent
} from '@/modules/core/events/types/index';
import type { ICreateUserOptions, IUserWithRoles } from '@/modules/core/auth/types/user-service.types';

/**
 * UserEventService handles user operations via the event bus.
 * This service replaces direct database access with event-driven communication
 * to the users module.
 */
export class UserEventService {
  private static instance: UserEventService | undefined;
  private logger?: ILogger;
  private eventBus?: EventBusService;
  private responseHandlers: Map<string, (response: any) => void> = new Map();
  private handlersSetup = false;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
  }

  /**
   * Get singleton instance of UserEventService.
   * @returns UserEventService instance.
   */
  public static getInstance(): UserEventService {
    UserEventService.instance ??= new UserEventService();
    return UserEventService.instance;
  }

  /**
   * Get event bus instance.
   * @returns Event bus instance.
   */
  private getEventBus(): EventBusService {
    if (!this.eventBus) {
      this.eventBus = EventBusService.getInstance();
      if (!this.handlersSetup) {
        this.setupEventHandlers();
        this.handlersSetup = true;
      }
    }
    return this.eventBus;
  }

  /**
   * Get logger instance.
   * @returns Logger instance.
   */
  private getLogger(): ILogger {
    if (!this.logger) {
      this.logger = getLoggerService();
    }
    return this.logger;
  }

  /**
   * Setup event handlers for user responses.
   */
  private setupEventHandlers(): void {
    // Handle OAuth user creation responses
    this.eventBus!.on<UserCreateOAuthResponseEvent>(
      UserEvents.USER_CREATE_OAUTH_RESPONSE,
      (data: unknown) => {
        const response = data as UserCreateOAuthResponseEvent;
        const handler = this.responseHandlers.get(response.requestId);
        if (handler) {
          handler(response);
          this.responseHandlers.delete(response.requestId);
        }
      }
    );

    // Handle user data responses
    this.eventBus!.on<UserDataResponseEvent>(
      UserEvents.USER_DATA_RESPONSE,
      (data: unknown) => {
        const response = data as UserDataResponseEvent;
        const handler = this.responseHandlers.get(response.requestId);
        if (handler) {
          handler(response);
          this.responseHandlers.delete(response.requestId);
        }
      }
    );
  }

  /**
   * Create or update a user from OAuth login via events.
   * @param options - User creation/update options.
   * @returns Promise resolving to user with roles.
   */
  async createOrUpdateUserFromOauth(options: ICreateUserOptions): Promise<IUserWithRoles> {
    const requestId = randomUUID();
    
    const request: UserCreateOAuthRequestEvent = {
      requestId,
      provider: options.provider,
      providerId: options.providerId,
      email: options.email,
      name: options.name,
      avatar: options.avatar
    };

    return new Promise((resolve, reject) => {
      // Set up response handler with timeout
      const timeout = setTimeout(() => {
        this.responseHandlers.delete(requestId);
        reject(new Error('OAuth user creation timeout'));
      }, 5000);

      this.responseHandlers.set(requestId, (response: UserCreateOAuthResponseEvent) => {
        clearTimeout(timeout);
        
        if (response.success && response.user) {
          // For now, return a minimal user object
          // In a complete implementation, we'd fetch full user details via another event
          const user: IUserWithRoles = {
            id: response.user.id,
            username: response.user.username,
            email: response.user.email,
            name: options.name || response.user.username,
            avatarurl: options.avatar || null,
            status: 'active',
            emailverified: true, // OAuth users are email verified
            roles: response.user.roles || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          resolve(user);
        } else {
          reject(new Error(response.error || 'Failed to create OAuth user'));
        }
      });

      // Emit the request
      this.getEventBus().emit(UserEvents.USER_CREATE_OAUTH_REQUEST, request);
    });
  }

  /**
   * Get user by ID via events.
   * @param userId - User ID to retrieve.
   * @returns Promise resolving to user with roles or null.
   */
  async getUserById(userId: string): Promise<IUserWithRoles | null> {
    const requestId = randomUUID();
    
    const request: UserDataRequestEvent = {
      requestId,
      userId
    };

    return new Promise((resolve) => {
      // Set up response handler with timeout
      const timeout = setTimeout(() => {
        this.responseHandlers.delete(requestId);
        resolve(null);
      }, 5000);

      this.responseHandlers.set(requestId, (response: UserDataResponseEvent) => {
        clearTimeout(timeout);
        
        if (response.user) {
          // Convert to IUserWithRoles format
          const user: IUserWithRoles = {
            id: response.user.id,
            username: response.user.username,
            email: response.user.email,
            name: response.user.username,
            avatarurl: null,
            status: response.user.status,
            emailverified: response.user.emailVerified,
            roles: [], // Roles will be managed by auth module
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          resolve(user);
        } else {
          resolve(null);
        }
      });

      // Emit the request
      this.getEventBus().emit(UserEvents.USER_DATA_REQUEST, request);
    });
  }

  /**
   * Get user by email via events.
   * @param email - User email to search for.
   * @returns Promise resolving to user with roles or null.
   */
  async getUserByEmail(email: string): Promise<IUserWithRoles | null> {
    const requestId = randomUUID();
    
    const request: UserDataRequestEvent = {
      requestId,
      email
    };

    return new Promise((resolve) => {
      // Set up response handler with timeout
      const timeout = setTimeout(() => {
        this.responseHandlers.delete(requestId);
        resolve(null);
      }, 5000);

      this.responseHandlers.set(requestId, (response: UserDataResponseEvent) => {
        clearTimeout(timeout);
        
        if (response.user) {
          // Convert to IUserWithRoles format
          const user: IUserWithRoles = {
            id: response.user.id,
            username: response.user.username,
            email: response.user.email,
            name: response.user.username,
            avatarurl: null,
            status: response.user.status,
            emailverified: response.user.emailVerified,
            roles: [], // Roles will be managed by auth module
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          resolve(user);
        } else {
          resolve(null);
        }
      });

      // Emit the request
      this.getEventBus().emit(UserEvents.USER_DATA_REQUEST, request);
    });
  }

  /**
   * Check if any admin users exist.
   * For now, this always returns false since the auth module manages roles.
   * @returns Promise resolving to boolean.
   */
  async hasAdminUsers(): Promise<boolean> {
    // In the new architecture, admin status is determined by auth module roles
    // not by the users module. So we'll need to check auth tables instead.
    this.getLogger().info(LogSource.AUTH, 'Checking for admin users via auth module');
    
    // TODO: Implement proper admin check via auth roles
    return false;
  }
}