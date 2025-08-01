/**
 * OAuth service implementation - manages OAuth user operations.
 * @file OAuth service implementation.
 * @module auth/services
 * Provides business logic for OAuth user management operations.
 */

import { randomUUID } from 'crypto';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { AuthRepository } from '@/modules/core/auth/repositories/auth.repository';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import {
  UserEvents,
  type UserDataRequestEvent,
  type UserDataResponseEvent,
  type UserCreateRequestEvent,
  type UserCreateResponseEvent,
  type UserUpdateRequestEvent,
  type UserUpdateResponseEvent
} from '@/modules/core/events/types/index';

/**
 * Service for managing OAuth user operations.
 * Internal service not exposed through module exports.
 */
export class OAuthService {
  private static instance: OAuthService;
  private readonly repository: AuthRepository;
  private readonly eventBus: EventBusService;
  private logger?: ILogger;
  private initialized = false;

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    this.repository = AuthRepository.getInstance();
    this.eventBus = EventBusService.getInstance();
  }

  /**
   * Get singleton instance.
   * @returns The OAuth service instance.
   */
  static getInstance(): OAuthService {
    OAuthService.instance ||= new OAuthService();
    return OAuthService.instance;
  }

  /**
   * Set logger instance.
   * @param logger - The logger instance to use.
   */
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * Initialize the service.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.repository.initialize();
    this.initialized = true;
    this.logger?.info(LogSource.AUTH, 'OAuth service initialized');
  }

  /**
   * Create or update user from OAuth provider data.
   * @param providerData - The provider data.
   * @param providerData.provider - The provider name.
   * @param providerData.providerId - The provider user ID.
   * @param providerData.email - The user email.
   * @param providerData.name - The user name.
   * @param providerData.avatarUrl - The user avatar URL.
   * @returns Promise that resolves to user ID.
   */
  public async createOrUpdateUserFromOAuth(providerData: {
    provider: string;
    providerId: string;
    email: string;
    name?: string;
    avatarUrl?: string;
  }): Promise<string> {
    await this.ensureInitialized();

    this.logger?.info(LogSource.AUTH, `Creating/updating user from OAuth: ${providerData.email}`);

    // First, check if user exists by requesting user data
    const checkRequestId = randomUUID();
    const userExists = await this.requestUserByEmail(providerData.email);

    let userId: string;

    if (!userExists) {
      // Create new user via event
      const createRequestId = randomUUID();
      userId = await this.createUserViaEvent({
        requestId: createRequestId,
        email: providerData.email,
        username: providerData.email.split('@')[0],
        display_name: providerData.name || providerData.email.split('@')[0],
        avatar_url: providerData.avatarUrl
      });
    } else {
      userId = userExists.id;
      
      // Update existing user if we have new data
      if (providerData.name || providerData.avatarUrl) {
        const updateRequestId = randomUUID();
        const updates: any = {};
        if (providerData.name) updates.display_name = providerData.name;
        if (providerData.avatarUrl) updates.avatar_url = providerData.avatarUrl;
        
        await this.updateUserViaEvent({
          requestId: updateRequestId,
          userId,
          updates
        });
      }
    }

    // Store OAuth identity
    await this.repository.createOrUpdateOAuthIdentity({
      user_id: userId,
      provider: providerData.provider,
      provider_user_id: providerData.providerId,
      provider_email: providerData.email,
      provider_name: providerData.name,
      provider_picture: providerData.avatarUrl
    });

    return userId;
  }

  /**
   * Request user data from stored OAuth identity.
   * @param provider - The provider name.
   * @param userId - The user ID.
   * @returns Promise that resolves to user data.
   */
  public async requestUserData(provider: string, userId: string): Promise<{
    email: string;
    name?: string;
    avatarUrl?: string;
  } | null> {
    await this.ensureInitialized();

    this.logger?.info(LogSource.AUTH, `Requesting user data from ${provider} for user: ${userId}`);

    const identity = await this.repository.getOAuthIdentity(userId, provider);
    
    if (!identity) {
      return null;
    }

    return {
      email: identity.provider_email || '',
      name: identity.provider_name || undefined,
      avatarUrl: identity.provider_picture || undefined
    };
  }

  /**
   * Request user by email via events.
   * @param email - User email to search for.
   * @returns Promise that resolves to user data or null.
   */
  private async requestUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    return new Promise((resolve, reject) => {
      const requestId = randomUUID();
      const timeout = setTimeout(() => {
        this.eventBus.off(UserEvents.USER_DATA_RESPONSE, responseHandler);
        resolve(null);
      }, 5000);

      const responseHandler = (event: UserDataResponseEvent) => {
        if (event.requestId === requestId) {
          clearTimeout(timeout);
          this.eventBus.off(UserEvents.USER_DATA_RESPONSE, responseHandler);
          resolve(event.user);
        }
      };

      this.eventBus.on(UserEvents.USER_DATA_RESPONSE, responseHandler);

      // Emit request
      this.eventBus.emit(UserEvents.USER_DATA_REQUEST, {
        requestId,
        email
      } as UserDataRequestEvent);
    });
  }

  /**
   * Create user via events.
   * @param data - User creation data.
   * @returns Promise that resolves to user ID.
   */
  private async createUserViaEvent(data: UserCreateRequestEvent): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.eventBus.off(UserEvents.USER_CREATE_RESPONSE, responseHandler);
        reject(new Error('User creation timeout'));
      }, 5000);

      const responseHandler = (event: UserCreateResponseEvent) => {
        if (event.requestId === data.requestId) {
          clearTimeout(timeout);
          this.eventBus.off(UserEvents.USER_CREATE_RESPONSE, responseHandler);
          
          if (event.error) {
            reject(new Error(event.error));
          } else if (event.userId) {
            resolve(event.userId);
          } else {
            reject(new Error('User creation failed'));
          }
        }
      };

      this.eventBus.on(UserEvents.USER_CREATE_RESPONSE, responseHandler);
      this.eventBus.emit(UserEvents.USER_CREATE_REQUEST, data);
    });
  }

  /**
   * Update user via events.
   * @param data - User update data.
   * @returns Promise that resolves when update is complete.
   */
  private async updateUserViaEvent(data: UserUpdateRequestEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.eventBus.off(UserEvents.USER_UPDATE_RESPONSE, responseHandler);
        reject(new Error('User update timeout'));
      }, 5000);

      const responseHandler = (event: UserUpdateResponseEvent) => {
        if (event.requestId === data.requestId) {
          clearTimeout(timeout);
          this.eventBus.off(UserEvents.USER_UPDATE_RESPONSE, responseHandler);
          
          if (event.error) {
            reject(new Error(event.error));
          } else if (event.success) {
            resolve();
          } else {
            reject(new Error('User update failed'));
          }
        }
      };

      this.eventBus.on(UserEvents.USER_UPDATE_RESPONSE, responseHandler);
      this.eventBus.emit(UserEvents.USER_UPDATE_REQUEST, data);
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