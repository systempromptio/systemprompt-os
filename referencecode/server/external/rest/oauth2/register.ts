/**
 * @fileoverview OAuth2 Dynamic Client Registration endpoint (RFC 7591)
 * @module server/external/rest/oauth2/register
 *
 * @see {@link https://datatracker.ietf.org/doc/rfc7591/}
 */

import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from '@/modules/core/logger/services/logger.service.js';

const logger = LoggerService.getInstance();

/**
 * Client registration request as per RFC 7591
 */
export interface ClientRegistrationRequest {
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  redirect_uris?: string[];
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
  contacts?: string[];
  tos_uri?: string;
  policy_uri?: string;
  jwks_uri?: string;
  software_id?: string;
  software_version?: string;
}

/**
 * Client registration response
 */
export interface ClientRegistrationResponse extends ClientRegistrationRequest {
  client_id: string;
  client_secret?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  registration_access_token?: string;
  registration_client_uri?: string;
}

/**
 * In-memory client store (replace with database in production)
 */
const registeredClients = new Map<string, ClientRegistrationResponse>();

export class RegisterEndpoint {
  /**
   * POST /oauth2/register
   * Dynamic client registration endpoint
   */
  register = async (req: Request, res: Response): Promise<Response> => {
    try {
      logger.info('Client registration request received', {
        body: req.body,
      });

      const registrationRequest = req.body as ClientRegistrationRequest;

      // Validate required fields
      if (!registrationRequest.redirect_uris || registrationRequest.redirect_uris.length === 0) {
        return res.status(400).json({
          error: 'invalid_redirect_uri',
          error_description: 'At least one redirect_uri is required',
        });
      }

      // Generate client credentials
      const clientId = `mcp-${uuidv4()}`;
      const clientSecret = uuidv4();
      const issuedAt = Math.floor(Date.now() / 1000);

      // Build registration response
      const registrationResponse: ClientRegistrationResponse = {
        client_id: clientId,
        client_secret: clientSecret,
        client_id_issued_at: issuedAt,
        client_secret_expires_at: 0, // Never expires
        client_name: registrationRequest.client_name || 'MCP Client',
        redirect_uris: registrationRequest.redirect_uris,
        token_endpoint_auth_method:
          registrationRequest.token_endpoint_auth_method || 'client_secret_basic',
        grant_types: registrationRequest.grant_types || ['authorization_code', 'refresh_token'],
        response_types: registrationRequest.response_types || ['code'],
        scope: registrationRequest.scope || 'openid profile email',
        // Copy over optional fields
        ...(registrationRequest.client_uri && { client_uri: registrationRequest.client_uri }),
        ...(registrationRequest.logo_uri && { logo_uri: registrationRequest.logo_uri }),
        ...(registrationRequest.contacts && { contacts: registrationRequest.contacts }),
        ...(registrationRequest.tos_uri && { tos_uri: registrationRequest.tos_uri }),
        ...(registrationRequest.policy_uri && { policy_uri: registrationRequest.policy_uri }),
        ...(registrationRequest.jwks_uri && { jwks_uri: registrationRequest.jwks_uri }),
        ...(registrationRequest.software_id && { software_id: registrationRequest.software_id }),
        ...(registrationRequest.software_version && {
          software_version: registrationRequest.software_version,
        }),
      };

      // Store client (in production, save to database)
      registeredClients.set(clientId, registrationResponse);

      logger.info('Client registered successfully', {
        clientId,
        clientName: registrationResponse.client_name,
        redirectUris: registrationResponse.redirect_uris,
      });

      // Return registration response
      return res.status(201).json(registrationResponse);
    } catch (error) {
      logger.error('Client registration failed', { error });
      return res.status(500).json({
        error: 'servererror',
        error_description: 'An error occurred during client registration',
      });
    }
  };

  /**
   * Get a registered client by ID (for internal use)
   */
  static getClient(clientId: string): ClientRegistrationResponse | undefined {
    return registeredClients.get(clientId);
  }

  /**
   * Validate client credentials (for internal use)
   */
  static validateClient(clientId: string, clientSecret?: string): boolean {
    const client = registeredClients.get(clientId);
    if (!client) {
      return false;
    }

    // If no secret is required (public client)
    if (client.token_endpoint_auth_method === 'none') {
      return true;
    }

    // Validate secret
    return client.client_secret === clientSecret;
  }

  /**
   * Register a client programmatically (for internal use)
   */
  static registerClient(
    registration: ClientRegistrationRequest & { client_id?: string },
  ): ClientRegistrationResponse {
    const clientId = registration.client_id || `mcp-${uuidv4()}`;
    const clientSecret = registration.token_endpoint_auth_method === 'none' ? undefined : uuidv4();
    const issuedAt = Math.floor(Date.now() / 1000);

    const response: ClientRegistrationResponse = {
      client_id: clientId,
      ...(clientSecret && { client_secret: clientSecret }),
      client_id_issued_at: issuedAt,
      client_secret_expires_at: 0,
      client_name: registration.client_name || 'OAuth Client',
      redirect_uris: registration.redirect_uris || [],
      token_endpoint_auth_method: registration.token_endpoint_auth_method || 'client_secret_basic',
      grant_types: registration.grant_types || ['authorization_code'],
      response_types: registration.response_types || ['code'],
      scope: registration.scope || 'openid profile email',
    };

    registeredClients.set(clientId, response);
    return response;
  }
}
