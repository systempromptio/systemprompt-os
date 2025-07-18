/**
 * @fileoverview Auth module - Authentication and security utilities
 * @module modules/core/auth
 */

// Module interface defined locally
export interface ModuleInterface {
  name: string;
  version: string;
  type: 'core' | 'service' | 'extension';
  initialize(context: { config?: any; logger?: any }): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ProviderManager } from './services/provider-manager.js';
import { IdentityProvider } from './types/provider-interface.js';

// Get the directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AuthModule implements ModuleInterface {
  name = 'auth';
  version = '1.0.0';
  type = 'service' as const;
  
  private config: any;
  private logger: any;
  private providerManager: ProviderManager | null = null;
  
  async initialize(context: { config?: any; logger?: any }): Promise<void> {
    this.config = context.config || {};
    this.logger = context.logger;
    
    // Ensure key store directory exists
    const keyStorePath = this.config.keyStorePath || './state/auth/keys';
    const absolutePath = resolve(process.cwd(), keyStorePath);
    
    if (!existsSync(absolutePath)) {
      mkdirSync(absolutePath, { recursive: true });
      this.logger?.info(`Created key store directory: ${absolutePath}`);
    }
    
    // Initialize provider manager
    // In production/Docker, providers are in the source directory
    const providersPath = process.env.NODE_ENV === 'production' 
      ? '/app/src/modules/core/auth'  // Docker container path
      : resolve(__dirname);
    this.providerManager = new ProviderManager(providersPath, this.logger);
    
    this.logger?.info('Auth module initialized');
  }
  
  async start(): Promise<void> {
    // Initialize provider manager
    if (this.providerManager) {
      this.logger?.info('Initializing provider manager...');
      await this.providerManager.initialize();
      const providers = this.providerManager.listProviderIds();
      this.logger?.info(`Auth module started with providers: ${providers.join(', ') || 'none'}`);
    } else {
      this.logger?.info('Auth module started (no provider manager)');
    }
  }
  
  async stop(): Promise<void> {
    this.logger?.info('Auth module stopped');
  }
  
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Check if key store is accessible
      const keyStorePath = this.config.keyStorePath || './state/auth/keys';
      const absolutePath = resolve(process.cwd(), keyStorePath);
      
      if (!existsSync(absolutePath)) {
        return { healthy: false, message: 'Key store directory not found' };
      }
      
      // Check provider manager health
      if (this.providerManager) {
        const providers = this.providerManager.listProviderIds();
        return { 
          healthy: true, 
          message: `${providers.length} provider(s) configured` 
        };
      }
      
      return { healthy: true };
    } catch (error) {
      return { healthy: false, message: `Health check failed: ${error}` };
    }
  }
  
  /**
   * Get the provider manager instance
   */
  getProviderManager(): ProviderManager | null {
    return this.providerManager;
  }
  
  /**
   * Get a specific provider by ID
   */
  getProvider(id: string): IdentityProvider | undefined {
    return this.providerManager?.getProvider(id);
  }
  
  /**
   * Get all configured providers
   */
  getAllProviders(): IdentityProvider[] {
    return this.providerManager?.getAllProviders() || [];
  }
  
  /**
   * Check if a provider is available
   */
  hasProvider(id: string): boolean {
    return this.providerManager?.hasProvider(id) || false;
  }
  
  /**
   * Reload provider configurations
   */
  async reloadProviders(): Promise<void> {
    await this.providerManager?.reload();
  }
}