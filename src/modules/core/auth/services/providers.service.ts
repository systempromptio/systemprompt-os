/**
 * ProvidersService - manages OAuth provider configurations in database.
 * Replaces the file-based ProviderRegistry with database storage.
 * @module auth/services
 */

import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { type IAuthProvidersRow } from '@/modules/core/auth/types/database.generated';
import { ProviderFactoryService } from '@/modules/core/auth/services/provider-factory.service';
import type {
  IIdentityProvider
} from '@/modules/core/auth/types/provider-interface';

/**
 * Input for creating a new provider.
 */
export interface IProviderCreateInput {
  id: string;
  name: string;
  type: 'oauth2' | 'oidc';
  enabled?: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  issuer?: string;
  discoveryEndpoint?: string;
  scopes?: string[];
  userinfoMapping?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * Input for updating an existing provider.
 */
export interface IProviderUpdateInput {
  name?: string;
  enabled?: boolean;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  issuer?: string;
  discoveryEndpoint?: string;
  scopes?: string[];
  userinfoMapping?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * ProvidersService manages OAuth provider configurations in the database.
 * Provides CRUD operations and instantiates provider implementations.
 */
export class ProvidersService {
  private static instance: ProvidersService | null = null;
  private readonly logger: ILogger;
  private readonly database: DatabaseService;
  private providerFactory?: ProviderFactoryService;
  private readonly providerInstances = new Map<string, IIdentityProvider>();

  private constructor() {
    this.logger = LoggerService.getInstance();
    this.database = DatabaseService.getInstance();
  }

  /**
   * Get the singleton instance.
   */
  static getInstance(): ProvidersService {
    if (ProvidersService.instance === null) {
      ProvidersService.instance = new ProvidersService();
    }
    return ProvidersService.instance;
  }

  /**
   * Initialize the service and load enabled providers.
   */
  async initialize(): Promise<void> {
    // Initialize provider factory lazily
    this.providerFactory = ProviderFactoryService.getInstance();
    await this.providerFactory.initialize();
    await this.loadEnabledProviders();
    this.logger.info(LogSource.AUTH, 'ProvidersService initialized');
  }

  /**
   * Create a new provider configuration.
   * @param input
   */
  async createProvider(input: IProviderCreateInput): Promise<IAuthProvidersRow> {
    const now = new Date().toISOString();

    const row: IAuthProvidersRow = {
      id: input.id,
      name: input.name,
      type: input.type,
      enabled: input.enabled ? 1 : 0,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri || null,
      authorization_endpoint: input.authorizationEndpoint,
      token_endpoint: input.tokenEndpoint,
      userinfo_endpoint: input.userinfoEndpoint || null,
      jwks_uri: input.jwksUri || null,
      issuer: input.issuer || null,
      discovery_endpoint: input.discoveryEndpoint || null,
      scopes: input.scopes ? JSON.stringify(input.scopes) : null,
      userinfo_mapping: input.userinfoMapping ? JSON.stringify(input.userinfoMapping) : null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      created_at: now,
      updated_at: now,
    };

    await this.database.execute(
      `INSERT INTO auth_providers (
        id, name, type, enabled, client_id, client_secret, redirect_uri,
        authorization_endpoint, token_endpoint, userinfo_endpoint, jwks_uri,
        issuer, discovery_endpoint, scopes, userinfo_mapping, metadata,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id, row.name, row.type, row.enabled, row.client_id, row.client_secret,
        row.redirect_uri, row.authorization_endpoint, row.token_endpoint,
        row.userinfo_endpoint, row.jwks_uri, row.issuer, row.discovery_endpoint,
        row.scopes, row.userinfo_mapping, row.metadata, row.created_at, row.updated_at
      ]
    );

    if (input.enabled) {
      await this.instantiateProvider(row);
    }

    this.logger.info(LogSource.AUTH, `Created provider: ${input.id}`);
    return row;
  }

  /**
   * Update an existing provider configuration.
   * @param id
   * @param input
   */
  async updateProvider(id: string, input: IProviderUpdateInput): Promise<IAuthProvidersRow | null> {
    const existing = await this.getProvider(id);
    if (!existing) {
      return null;
    }

    const updates = [];
    const values = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(input.enabled ? 1 : 0);
    }
    if (input.clientId !== undefined) {
      updates.push('client_id = ?');
      values.push(input.clientId);
    }
    if (input.clientSecret !== undefined) {
      updates.push('client_secret = ?');
      values.push(input.clientSecret);
    }
    if (input.redirectUri !== undefined) {
      updates.push('redirect_uri = ?');
      values.push(input.redirectUri);
    }
    if (input.authorizationEndpoint !== undefined) {
      updates.push('authorization_endpoint = ?');
      values.push(input.authorizationEndpoint);
    }
    if (input.tokenEndpoint !== undefined) {
      updates.push('token_endpoint = ?');
      values.push(input.tokenEndpoint);
    }
    if (input.userinfoEndpoint !== undefined) {
      updates.push('userinfo_endpoint = ?');
      values.push(input.userinfoEndpoint);
    }
    if (input.jwksUri !== undefined) {
      updates.push('jwks_uri = ?');
      values.push(input.jwksUri);
    }
    if (input.issuer !== undefined) {
      updates.push('issuer = ?');
      values.push(input.issuer);
    }
    if (input.discoveryEndpoint !== undefined) {
      updates.push('discovery_endpoint = ?');
      values.push(input.discoveryEndpoint);
    }
    if (input.scopes !== undefined) {
      updates.push('scopes = ?');
      values.push(JSON.stringify(input.scopes));
    }
    if (input.userinfoMapping !== undefined) {
      updates.push('userinfo_mapping = ?');
      values.push(JSON.stringify(input.userinfoMapping));
    }
    if (input.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(input.metadata));
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.database.execute(
      `UPDATE auth_providers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await this.getProvider(id);
    if (updated) {
      if (input.enabled !== undefined) {
        if (input.enabled) {
          await this.instantiateProvider(updated);
        } else {
          this.providerInstances.delete(id);
        }
      } else if (updated.enabled) {
        await this.instantiateProvider(updated);
      }
    }

    this.logger.info(LogSource.AUTH, `Updated provider: ${id}`);
    return updated;
  }

  /**
   * Delete a provider configuration.
   * @param id
   */
  async deleteProvider(id: string): Promise<boolean> {
    const result = await this.database.execute(
      'DELETE FROM auth_providers WHERE id = ?',
      [id]
    );

    this.providerInstances.delete(id);

    if ((result as any).changes && (result as any).changes > 0) {
      this.logger.info(LogSource.AUTH, `Deleted provider: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Get a provider configuration by id.
   * @param id
   */
  async getProvider(id: string): Promise<IAuthProvidersRow | null> {
    const results = await this.database.query<IAuthProvidersRow>(
      'SELECT * FROM auth_providers WHERE id = ?',
      [id]
    );
    return results[0] || null;
  }

  /**
   * Get all provider configurations.
   */
  async getAllProviders(): Promise<IAuthProvidersRow[]> {
    return await this.database.query<IAuthProvidersRow>(
      'SELECT * FROM auth_providers ORDER BY name'
    );
  }

  /**
   * Get enabled provider configurations.
   */
  async getEnabledProviders(): Promise<IAuthProvidersRow[]> {
    return await this.database.query<IAuthProvidersRow>(
      'SELECT * FROM auth_providers WHERE enabled = 1 ORDER BY name'
    );
  }

  /**
   * Get a provider instance by id.
   * @param id
   */
  getProviderInstance(id: string): IIdentityProvider | undefined {
    return this.providerInstances.get(id);
  }

  /**
   * Get all provider instances.
   */
  getAllProviderInstances(): IIdentityProvider[] {
    return Array.from(this.providerInstances.values());
  }

  /**
   * Check if a provider exists and is enabled.
   * @param id
   */
  hasProvider(id: string): boolean {
    return this.providerInstances.has(id);
  }

  /**
   * Enable/disable a provider.
   * @param id
   * @param enabled
   */
  async toggleProvider(id: string, enabled: boolean): Promise<boolean> {
    const result = await this.updateProvider(id, { enabled });
    return result !== null;
  }

  /**
   * Reload all enabled providers.
   */
  async reloadProviders(): Promise<void> {
    this.providerInstances.clear();
    await this.loadEnabledProviders();
    this.logger.info(LogSource.AUTH, 'Reloaded all providers');
  }

  /**
   * Load enabled providers and instantiate them.
   */
  private async loadEnabledProviders(): Promise<void> {
    const enabledProviders = await this.getEnabledProviders();

    for (const providerConfig of enabledProviders) {
      try {
        await this.instantiateProvider(providerConfig);
      } catch (error) {
        this.logger.error(LogSource.AUTH, `Failed to instantiate provider ${providerConfig.id}`, {
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }
  }

  /**
   * Instantiate a provider from database configuration.
   * @param config
   */
  private async instantiateProvider(config: IAuthProvidersRow): Promise<void> {
    // Ensure factory is initialized
    if (!this.providerFactory) {
      this.providerFactory = ProviderFactoryService.getInstance();
      await this.providerFactory.initialize();
    }

    // Validate configuration
    if (!this.providerFactory.validateProviderConfig(config)) {
      this.logger.error(LogSource.AUTH, `Invalid provider configuration for ${config.id}`);
      return;
    }

    // Use factory to create provider
    const provider = await this.providerFactory.createProvider(config);

    if (provider) {
      this.providerInstances.set(config.id, provider);
      this.logger.info(LogSource.AUTH, `Instantiated provider: ${config.id}`);
    } else {
      this.logger.error(LogSource.AUTH, `Failed to instantiate provider: ${config.id}`);
    }
  }

}
