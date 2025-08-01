/**
 * OAuth service implementation - manages OAuth user operations.
 * @file OAuth service implementation.
 * @module auth/services
 * Provides business logic for OAuth user management operations.
 */

import { randomUUID } from 'crypto';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { AuthRepository } from '@/modules/core/auth/repositories/auth.repository';
import { EventBusService } from '@/modules/core/events/services/events.service';
import {
  type UserCreateOAuthRequestEvent,
  type UserCreateOAuthResponseEvent,
  type UserDataRequestEvent,
  type UserDataResponseEvent,
  UserEvents
} from '@/modules/core/events/types/manual';

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
    if (this.initialized) { return; }

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

    const userExists = await this.requestUserByEmail(providerData.email);

    let userId: string;

    if (!userExists) {
      const createRequestId = randomUUID();
      const createEventData: UserCreateOAuthRequestEvent = {
        requestId: createRequestId,
        provider: providerData.provider,
        providerId: providerData.providerId,
        email: providerData.email
      };
      if (providerData.name) { createEventData.name = providerData.name; }
      if (providerData.avatarUrl) { createEventData.avatar = providerData.avatarUrl; }

      userId = await this.createUserViaEvent(createEventData);
    } else {
      userId = userExists.id;
    }

    await this.repository.createOrUpdateOAuthIdentity({
      user_id: userId,
      provider: providerData.provider,
      provider_user_id: providerData.providerId,
      provider_email: providerData.email,
      provider_name: providerData.name || null,
      provider_picture: providerData.avatarUrl || null
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

    const result: { email: string; name?: string; avatarUrl?: string } = {
      email: identity.provider_email || ''
    };

    if (identity.provider_name) {
      result.name = identity.provider_name;
    }

    if (identity.provider_picture) {
      result.avatarUrl = identity.provider_picture;
    }

    return result;
  }

  /**
   * Request user by email via events.
   * @param email - User email to search for.
   * @returns Promise that resolves to user data or null.
   */
  private async requestUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    return await new Promise((resolve) => {
      const requestId = randomUUID();
      const timeout = setTimeout(() => {
        this.eventBus.off(UserEvents.USER_DATA_RESPONSE, responseHandler);
        resolve(null);
      }, 5000);

      const responseHandler = (event: unknown) => {
        const typedEvent = event as UserDataResponseEvent;
        if (typedEvent.requestId === requestId) {
          clearTimeout(timeout);
          this.eventBus.off(UserEvents.USER_DATA_RESPONSE, responseHandler);
          resolve(typedEvent.user);
        }
      };

      this.eventBus.on<UserDataResponseEvent>(UserEvents.USER_DATA_RESPONSE, responseHandler);

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
  private async createUserViaEvent(data: UserCreateOAuthRequestEvent): Promise<string> {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.eventBus.off(UserEvents.USER_CREATE_OAUTH_RESPONSE, responseHandler);
        reject(new Error('User creation timeout'));
      }, 5000);

      const responseHandler = (event: unknown) => {
        const typedEvent = event as UserCreateOAuthResponseEvent;
        if (typedEvent.requestId === data.requestId) {
          clearTimeout(timeout);
          this.eventBus.off(UserEvents.USER_CREATE_OAUTH_RESPONSE, responseHandler);

          if (typedEvent.error) {
            reject(new Error(typedEvent.error));
          } else if (typedEvent.user?.id) {
            resolve(typedEvent.user.id);
          } else {
            reject(new Error('User creation failed'));
          }
        }
      };

      this.eventBus.on<UserCreateOAuthResponseEvent>(UserEvents.USER_CREATE_OAUTH_RESPONSE, responseHandler);
      this.eventBus.emit(UserEvents.USER_CREATE_OAUTH_REQUEST, data);
    });
  }

  // TODO: Implement updateUserViaEvent when USER_UPDATE events are available

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
