/**
 * @fileoverview Identity Provider Registry
 * @module server/external/auth/providers/registry
 */

import { IdentityProvider } from './interface.js';
import { GoogleProvider } from './google.js';
import { GitHubProvider } from './github.js';
import { GenericOAuth2Provider } from './generic-oauth2.js';

export class ProviderRegistry {
  private providers = new Map<string, IdentityProvider>();
  
  constructor() {
    this.registerDefaultProviders();
  }
  
  private registerDefaultProviders(): void {
    // Register Google provider with credentials from environment
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      this.register(new GoogleProvider({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.BASE_URL}/oauth2/callback/google`,
      }));
    }
    
    // Register GitHub provider if configured
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
      this.register(new GitHubProvider({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        redirect_uri: `${process.env.BASE_URL}/oauth2/callback/github`,
      }));
    }
    
    // Register custom OAuth2 providers from configuration
    this.loadCustomProviders();
  }
  
  private loadCustomProviders(): void {
    // TODO: Load custom provider configurations from config files
    // This allows users to add any OAuth2/OIDC provider via configuration
  }
  
  register(provider: IdentityProvider): void {
    this.providers.set(provider.id, provider);
  }
  
  get(providerId: string): IdentityProvider | undefined {
    return this.providers.get(providerId);
  }
  
  list(): IdentityProvider[] {
    return Array.from(this.providers.values());
  }
  
  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }
}

// Singleton instance
let registry: ProviderRegistry | null = null;

export function getProviderRegistry(): ProviderRegistry {
  if (!registry) {
    registry = new ProviderRegistry();
  }
  return registry;
}