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
import { ProviderRegistry } from './providers/registry.js';
import { IdentityProvider } from './types/provider-interface.js';
import { TunnelService } from './services/tunnel-service.js';

// Get the directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AuthModule implements ModuleInterface {
  name = 'auth';
  version = '1.0.0';
  type = 'service' as const;
  
  private config: any;
  private logger: any;
  private providerRegistry: ProviderRegistry | null = null;
  private tunnelService: TunnelService | null = null;
  
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
    
    // Initialize provider registry
    // In production/Docker, providers are in the source directory
    const providersPath = process.env.NODE_ENV === 'production' 
      ? '/app/src/modules/core/auth'  // Docker container path
      : resolve(__dirname);
    this.providerRegistry = new ProviderRegistry(providersPath, this.logger);
    
    this.logger?.info('Auth module initialized');
  }
  
  async start(): Promise<void> {
    // Start tunnel service if needed
    await this.startTunnelService();
    
    // Initialize provider registry
    if (this.providerRegistry) {
      this.logger?.info('Initializing provider registry...');
      await this.providerRegistry.initialize();
      const providers = this.providerRegistry.listProviderIds();
      this.logger?.info(`Auth module started with providers: ${providers.join(', ') || 'none'}`);
    } else {
      this.logger?.info('Auth module started (no provider registry)');
    }
  }
  
  async stop(): Promise<void> {
    if (this.tunnelService) {
      await this.tunnelService.stop();
    }
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
      
      // Check provider registry health
      if (this.providerRegistry) {
        const providers = this.providerRegistry.listProviderIds();
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
   * Get the provider registry instance
   */
  getProviderRegistry(): ProviderRegistry | null {
    return this.providerRegistry;
  }
  
  /**
   * Get a specific provider by ID
   */
  getProvider(id: string): IdentityProvider | undefined {
    return this.providerRegistry?.getProvider(id);
  }
  
  /**
   * Get all configured providers
   */
  getAllProviders(): IdentityProvider[] {
    return this.providerRegistry?.getAllProviders() || [];
  }
  
  /**
   * Check if a provider is available
   */
  hasProvider(id: string): boolean {
    return this.providerRegistry?.hasProvider(id) || false;
  }
  
  /**
   * Reload provider configurations
   */
  async reloadProviders(): Promise<void> {
    await this.providerRegistry?.reload();
  }
  
  /**
   * Starts the tunnel service for OAuth development
   */
  private async startTunnelService(): Promise<void> {
    const port = parseInt(process.env.PORT || '3000', 10);
    const permanentDomain = process.env.OAUTH_DOMAIN || process.env.PUBLIC_URL;
    const tunnelToken = process.env.CLOUDFLARE_TUNNEL_TOKEN;
    
    this.tunnelService = new TunnelService({
      port,
      permanentDomain,
      tunnelToken,
      enableInDevelopment: true
    }, this.logger);
    
    try {
      const url = await this.tunnelService.start();
      
      // Update OAuth configuration if tunnel is active
      const status = this.tunnelService.getStatus();
      if (status.active && status.type !== 'none') {
        await this.tunnelService.updateOAuthProviders(url);
        this.logger?.info(`OAuth providers configured with public URL: ${url}`);
      }
    } catch (error) {
      this.logger?.warn('Failed to start tunnel service:', error);
      this.logger?.info('Continuing with localhost configuration');
    }
  }
  
  /**
   * Get the public URL for OAuth callbacks
   */
  getPublicUrl(): string {
    return this.tunnelService?.getPublicUrl() || `http://localhost:${process.env.PORT || 3000}`;
  }
  
  /**
   * Get tunnel service status
   */
  getTunnelStatus(): any {
    return this.tunnelService?.getStatus() || { active: false, type: 'none' };
  }
}