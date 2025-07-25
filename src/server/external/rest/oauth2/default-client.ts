/**
 * Default OAuth client for registration/login pages.
 */

import { RegisterEndpoint } from '@/server/external/rest/oauth2/register.js';
import { LoggerService } from '@/modules/core/logger/index.js';
import { LogSource } from '@/modules/core/logger/types/index.js';

const logger = LoggerService.getInstance();

export interface DefaultClient {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
}

let defaultClient: DefaultClient | null = null;

/**
 * Get or create the default OAuth client for the registration/login flow.
 * @param baseUrl
 */
export async function getDefaultOAuthClient(baseUrl: string): Promise<DefaultClient> {
  if (defaultClient) {
    return defaultClient;
  }

  // Check if we have a persisted default client
  const existingClient = RegisterEndpoint.getClient('default-web-client');
  if (existingClient) {
    defaultClient = {
      client_id: existingClient.client_id,
      client_secret: existingClient.client_secret || '',
      redirect_uris: existingClient.redirect_uris || [],
    };
    return defaultClient;
  }

  // Create a new default client
  const registration = {
    client_name: 'SystemPrompt Web Client',
    client_id: 'default-web-client', // Use predictable ID
    redirect_uris: [
      `${baseUrl}/oauth2/callback/google`,
      `${baseUrl}/oauth2/callback/github`,
      `${baseUrl}/auth/callback`,
    ],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: 'openid profile email',
    token_endpoint_auth_method: 'none', // Public client
  };

  // Register the client
  const registeredClient = await RegisterEndpoint.registerClient(registration);

  defaultClient = {
    client_id: registeredClient.client_id,
    client_secret: registeredClient.client_secret || '',
    redirect_uris: registeredClient.redirect_uris || [],
  };

  logger.info(LogSource.AUTH, 'Created default OAuth client', {
    category: 'oauth2',
    action: 'client_create',
    persistToDb: true
  });

  return defaultClient;
}
