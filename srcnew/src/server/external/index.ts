/**
 * @fileoverview External REST API setup
 * @module server/external
 */

import { Express, Router } from 'express';
import { setupOAuth2Routes } from './rest/oauth2/index.js';
import { HealthEndpoint } from './rest/health.js';
import { StatusEndpoint } from './rest/status.js';
import { CONFIG } from '../config.js';
import { getProviderRegistry } from './auth/providers/registry.js';
import { GoogleProvider } from './auth/providers/google.js';
import { GitHubProvider } from './auth/providers/github.js';

export async function setupExternalAPI(app: Express): Promise<void> {
  const router = Router();
  
  // Initialize identity providers
  const registry = getProviderRegistry();
  
  // Register Google provider if configured
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    registry.register(new GoogleProvider({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${CONFIG.BASE_URL}/oauth2/callback/google`,
    }));
  }
  
  // Register GitHub provider if configured
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    registry.register(new GitHubProvider({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      redirect_uri: `${CONFIG.BASE_URL}/oauth2/callback/github`,
    }));
  }
  
  // OAuth2 Provider endpoints
  await setupOAuth2Routes(router, CONFIG.BASE_URL);
  
  // Health check endpoint
  const healthEndpoint = new HealthEndpoint();
  router.get('/health', healthEndpoint.getHealth);
  
  // Status endpoint
  const statusEndpoint = new StatusEndpoint();
  router.get('/status', statusEndpoint.getStatus);
  
  // Mount all external API routes
  app.use(router);
}