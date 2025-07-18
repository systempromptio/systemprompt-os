/**
 * @fileoverview External REST API setup
 * @module server/external
 */

import { Express, Router } from 'express';
import { setupOAuth2Routes } from './rest/oauth2/index.js';
import { HealthEndpoint } from './rest/health.js';
import { StatusEndpoint } from './rest/status.js';
import { CONFIG } from '../config.js';
import { initializeAuthModule } from '../../modules/core/auth/singleton.js';

export async function setupExternalAPI(app: Express, logger?: any): Promise<void> {
  const router = Router();
  
  // Initialize auth module with providers from configuration
  await initializeAuthModule({ 
    config: {
      keyStorePath: './state/auth/keys'
    },
    logger 
  });
  
  // Note: Providers are now loaded from YAML configuration files in
  // src/modules/core/auth/providers/
  // Enable providers by setting their credentials in environment variables:
  // - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET for Google
  // - GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET for GitHub
  // - Or add custom providers in src/modules/core/auth/providers/custom/
  
  // OAuth2 Provider endpoints
  await setupOAuth2Routes(router, CONFIG.BASEURL);
  
  // Health check endpoint
  const healthEndpoint = new HealthEndpoint();
  router.get('/health', (req, res) => {
    healthEndpoint.getHealth(req, res);
  });
  
  // Status endpoint
  const statusEndpoint = new StatusEndpoint();
  router.get('/status', (req, res) => {
    statusEndpoint.getStatus(req, res);
  });
  
  // Mount all external API routes
  app.use(router);
}