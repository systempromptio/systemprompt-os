/**
 * OAuth2 Dynamic Client Registration endpoint (RFC 7591).
 * @file OAuth2 Dynamic Client Registration endpoint (RFC 7591).
 * @module server/external/rest/oauth2/register
 * @see {@link https://datatracker.ietf.org/doc/rfc7591/}
 */

/*
 * LINT-STANDARDS-ENFORCER: Unable to resolve after 10 iterations. Remaining issues:
 * Line 153: Type assertion required for runtime validation - cannot be resolved without
 * compromising type safety in dynamic request body parsing
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
    if (client === undefined) {
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
    const needsSecret = registration.token_endpoint_auth_method !== 'none';
    const clientSecret = needsSecret ? uuidv4() : undefined;
    const issuedAt = Math.floor(Date.now() / 1000);

    const response: IClientRegistrationResponse = {
      client_id: clientId,
      client_id_issued_at: issuedAt,
      client_secret_expires_at: 0,
      client_name: registration.client_name ?? 'OAuth Client',
      redirect_uris: registration.redirect_uris ?? [],
      token_endpoint_auth_method: registration.token_endpoint_auth_method ?? 'client_secret_basic',
      grant_types: registration.grant_types ?? ['authorization_code'],
      response_types: registration.response_types ?? ['code'],
      scope: registration.scope ?? 'profile email',
    };

    if (clientSecret !== undefined) {
      response.client_secret = clientSecret;
    }

    registeredClients.set(clientId, response);
    return response;
  }

  /**
   * Clear all registered clients (for testing purposes only).
   * @internal
   */
  static clearAllClients(): void {
    registeredClients.clear();
  }

  /**
   * POST /oauth2/register
   * Dynamic client registration endpoint.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Express response.
   */
  register = (req: ExpressRequest, res: ExpressResponse): ExpressResponse => {
    try {
      logger.info(LogSource.AUTH, 'Client registration request received', {
        category: 'oauth2',
        action: 'client_register',
        persistToDb: false,
      });

      const registrationRequest = this.parseRequestBody(req.body);

      if (!this.hasValidRedirectUris(registrationRequest.redirect_uris)) {
        return res.status(400).json({
          error: 'invalid_redirect_uri',
          error_description: 'At least one redirect_uri is required',
        });
      }

      const registrationResponse = this.buildResponse(registrationRequest);
      const { client_id: clientId } = registrationResponse;

      registeredClients.set(clientId, registrationResponse);

      logger.info(LogSource.AUTH, 'Client registered successfully', {
        category: 'oauth2',
        action: 'client_register',
        persistToDb: true,
      });

      return res.status(201).json(registrationResponse);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * Parse and validate the request body.
   * @param body - The request body to parse.
   * @returns The parsed registration request.
   * @throws Will throw an error if the request body is invalid.
   */
  private parseRequestBody(body: unknown): IClientRegistrationRequest {
    if (body === null || body === undefined) {
      throw new Error('Request body is required');
    }

    if (typeof body !== 'object') {
      throw new Error('Request body must be an object');
    }

    const request = body as Record<string, unknown>;

    const clientRequest: IClientRegistrationRequest = {};

    const clientName = this.getStringField(request, 'client_name');
    if (clientName) { clientRequest.client_name = clientName; }

    const clientUri = this.getStringField(request, 'client_uri');
    if (clientUri) { clientRequest.client_uri = clientUri; }

    const logoUri = this.getStringField(request, 'logo_uri');
    if (logoUri) { clientRequest.logo_uri = logoUri; }

    const redirectUris = this.getArrayField(request, 'redirect_uris');
    if (redirectUris) { clientRequest.redirect_uris = redirectUris; }

    const tokenEndpointAuthMethod = this.getStringField(request, 'token_endpoint_auth_method');
    if (tokenEndpointAuthMethod) { clientRequest.token_endpoint_auth_method = tokenEndpointAuthMethod; }

    const grantTypes = this.getArrayField(request, 'grant_types');
    if (grantTypes) { clientRequest.grant_types = grantTypes; }

    const responseTypes = this.getArrayField(request, 'response_types');
    if (responseTypes) { clientRequest.response_types = responseTypes; }

    const scope = this.getStringField(request, 'scope');
    if (scope) { clientRequest.scope = scope; }

    const contacts = this.getArrayField(request, 'contacts');
    if (contacts) { clientRequest.contacts = contacts; }

    const tosUri = this.getStringField(request, 'tos_uri');
    if (tosUri) { clientRequest.tos_uri = tosUri; }

    const policyUri = this.getStringField(request, 'policy_uri');
    if (policyUri) { clientRequest.policy_uri = policyUri; }

    const jwksUri = this.getStringField(request, 'jwks_uri');
    if (jwksUri) { clientRequest.jwks_uri = jwksUri; }

    const softwareId = this.getStringField(request, 'software_id');
    if (softwareId) { clientRequest.software_id = softwareId; }

    const softwareVersion = this.getStringField(request, 'software_version');
    if (softwareVersion) { clientRequest.software_version = softwareVersion; }

    return clientRequest;
  }

  /**
   * Extract string field from request object.
   * @param request - The request object.
   * @param field - The field name.
   * @returns The string value or undefined.
   */
  private getStringField(request: Record<string, unknown>, field: string): string | undefined {
    const { [field]: value } = request;
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * Extract array field from request object.
   * @param request - The request object.
   * @param field - The field name.
   * @returns The array value or undefined.
   */
  private getArrayField(request: Record<string, unknown>, field: string): string[] | undefined {
    const { [field]: value } = request;
    return Array.isArray(value) ? value : undefined;
  }

  /**
   * Check if redirect URIs are valid.
   * @param redirectUris - The redirect URIs to validate.
   * @returns True if valid redirect URIs exist.
   */
  private hasValidRedirectUris(redirectUris?: string[]): boolean {
    return Array.isArray(redirectUris) && redirectUris.length > 0;
  }

  /**
   * Build the registration response.
   * @param request - The registration request.
   * @returns The registration response.
   */
  private buildResponse(request: IClientRegistrationRequest): IClientRegistrationResponse {
    const clientId = `mcp-${uuidv4()}`;
    const clientSecret = uuidv4();
    const issuedAt = Math.floor(Date.now() / 1000);

    const response: IClientRegistrationResponse = {
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: issuedAt,
      client_secret_expires_at: 0,
      client_name: request.client_name ?? 'MCP Client',
      redirect_uris: request.redirect_uris ?? [],
      token_endpoint_auth_method: request.token_endpoint_auth_method ?? 'client_secret_basic',
      grant_types: request.grant_types ?? ['authorization_code', 'refresh_token'],
      response_types: request.response_types ?? ['code'],
      scope: request.scope ?? 'profile email',
    };

    const additionalFields = this.buildOptionalFields(request);
    Object.assign(response, additionalFields);

    if (request.contacts !== undefined && request.contacts) {
      response.contacts = request.contacts;
    }

    return response;
  }

  /**
   * Build optional fields object from request.
   * @param request - The registration request.
   * @returns Object with optional fields that have valid values.
   */
  private buildOptionalFields(
    request: IClientRegistrationRequest,
  ): Partial<IClientRegistrationResponse> {
    const fields: Partial<IClientRegistrationResponse> = {};
    const stringFields = [
      'client_uri',
      'logo_uri',
      'tos_uri',
      'policy_uri',
      'jwks_uri',
      'software_id',
      'software_version',
    ] as const;

    stringFields.forEach((fieldName): void => {
      const { [fieldName]: value } = request;
      if (value !== undefined && value !== '' && typeof value === 'string') {
        fields[fieldName] = value;
      }
    });

    return fields;
  }

  /**
   * Handle registration errors.
   * @param error - The error that occurred.
   * @param res - The Express response object.
   * @returns The error response.
   */
  private handleError(error: unknown, res: ExpressResponse): ExpressResponse {
    const errorInstance = error instanceof Error ? error : new Error(String(error));

    logger.error(LogSource.AUTH, 'Client registration failed', {
      error: errorInstance,
      category: 'oauth2',
      action: 'client_register',
    });

    return res.status(500).json({
      error: 'server_error',
      error_description: 'An error occurred during client registration',
    });
  }
}
