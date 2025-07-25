/**
 * OAuth2 Dynamic Client Registration endpoint (RFC 7591).
 * @file OAuth2 Dynamic Client Registration endpoint (RFC 7591).
 * @module server/external/rest/oauth2/register
 * @see {@link https://datatracker.ietf.org/doc/rfc7591/}
 */

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type {
  IClientRegistrationRequest,
  IClientRegistrationResponse,
} from '@/server/external/rest/oauth2/types/index';

const logger = LoggerService.getInstance();

/**
 * In-memory client store (replace with database in production).
 */
const registeredClients = new Map<string, IClientRegistrationResponse>();

/**
 * OAuth2 client registration endpoint handler.
 */
export class RegisterEndpoint {
  /**
   * POST /oauth2/register
   * Dynamic client registration endpoint.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise resolving to Express response.
   */
  register = async (req: ExpressRequest, res: ExpressResponse): Promise<ExpressResponse> => {
    try {
      logger.info(LogSource.AUTH, 'Client registration request received', {
        category: 'oauth2',
        action: 'client_register',
        persistToDb: false,
      });

      const registrationRequest = req.body as IClientRegistrationRequest;

      if (!registrationRequest.redirect_uris?.length) {
        return res.status(400).json({
          error: 'invalid_redirect_uri',
          error_description: 'At least one redirect_uri is required',
        });
      }

      const clientId = `mcp-${uuidv4()}`;
      const clientSecret = uuidv4();
      const issuedAt = Math.floor(Date.now() / 1000);

      const registrationResponse: IClientRegistrationResponse = {
        client_id: clientId,
        client_secret: clientSecret,
        client_id_issued_at: issuedAt,
        client_secret_expires_at: 0,
        client_name: registrationRequest.client_name ?? 'MCP Client',
        redirect_uris: registrationRequest.redirect_uris,
        token_endpoint_auth_method:
          registrationRequest.token_endpoint_auth_method ?? 'client_secret_basic',
        grant_types: registrationRequest.grant_types ?? ['authorization_code', 'refresh_token'],
        response_types: registrationRequest.response_types ?? ['code'],
        scope: registrationRequest.scope ?? 'openid profile email',
        ...registrationRequest.client_uri && { client_uri: registrationRequest.client_uri },
        ...registrationRequest.logo_uri && { logo_uri: registrationRequest.logo_uri },
        ...registrationRequest.contacts && { contacts: registrationRequest.contacts },
        ...registrationRequest.tos_uri && { tos_uri: registrationRequest.tos_uri },
        ...registrationRequest.policy_uri && { policy_uri: registrationRequest.policy_uri },
        ...registrationRequest.jwks_uri && { jwks_uri: registrationRequest.jwks_uri },
        ...registrationRequest.software_id && { software_id: registrationRequest.software_id },
        ...registrationRequest.software_version && {
          software_version: registrationRequest.software_version,
        },
      };

      registeredClients.set(clientId, registrationResponse);

      logger.info(LogSource.AUTH, 'Client registered successfully', {
        category: 'oauth2',
        action: 'client_register',
        persistToDb: true,
      });

      return res.status(201).json(registrationResponse);
    } catch (error) {
      logger.error(LogSource.AUTH, 'Client registration failed', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'oauth2',
        action: 'client_register',
      });
      return res.status(500).json({
        error: 'server_error',
        error_description: 'An error occurred during client registration',
      });
    }
  };

  /**
   * Get a registered client by ID (for internal use).
   * @param clientId - The client ID to look up.
   * @returns The client registration response if found, otherwise undefined.
   */
  static getClient(clientId: string): IClientRegistrationResponse | undefined {
    return registeredClients.get(clientId);
  }

  /**
   * Validate client credentials (for internal use).
   * @param clientId - The client ID to validate.
   * @param clientSecret - The client secret to validate (optional for public clients).
   * @returns True if client credentials are valid, false otherwise.
   */
  static validateClient(clientId: string, clientSecret?: string): boolean {
    const client = registeredClients.get(clientId);
    if (!client) {
      return false;
    }

    if (client.token_endpoint_auth_method === 'none') {
      return true;
    }

    return client.client_secret === clientSecret;
  }

  /**
   * Register a client programmatically (for internal use).
   * @param registration - The client registration data.
   * @returns The client registration response.
   */
  static registerClient(
    registration: IClientRegistrationRequest & { client_id?: string },
  ): IClientRegistrationResponse {
    const clientId = registration.client_id ?? `mcp-${uuidv4()}`;
    const clientSecret = registration.token_endpoint_auth_method === 'none' ? undefined : uuidv4();
    const issuedAt = Math.floor(Date.now() / 1000);

    const response: IClientRegistrationResponse = {
      client_id: clientId,
      ...clientSecret && { client_secret: clientSecret },
      client_id_issued_at: issuedAt,
      client_secret_expires_at: 0,
      client_name: registration.client_name ?? 'OAuth Client',
      redirect_uris: registration.redirect_uris ?? [],
      token_endpoint_auth_method: registration.token_endpoint_auth_method ?? 'client_secret_basic',
      grant_types: registration.grant_types ?? ['authorization_code'],
      response_types: registration.response_types ?? ['code'],
      scope: registration.scope ?? 'openid profile email',
    };

    registeredClients.set(clientId, response);
    return response;
  }
}
