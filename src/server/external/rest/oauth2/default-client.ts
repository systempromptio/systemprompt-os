/**
 * Default OAuth client for registration/login pages.
 */

import { RegisterEndpoint } from '@/server/external/rest/oauth2/register';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';

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

  const existingClient = RegisterEndpoint.getClient('default-web-client');
  if (existingClient) {
    defaultClient = {
      client_id: existingClient.client_id,
      client_secret: existingClient.client_secret || '',
      redirect_uris: existingClient.redirect_uris || [],
    };
    return defaultClient;
  }

  const registration = {
    client_name: 'SystemPrompt Web Client',
    client_id: 'default-web-client',
    redirect_uris: [
      `${baseUrl}/oauth2/callback/google`,
      `${baseUrl}/oauth2/callback/github`,
      `${baseUrl}/auth/callback`,
    ],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: 'profile email',
    token_endpoint_auth_method: 'none'
  };

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
