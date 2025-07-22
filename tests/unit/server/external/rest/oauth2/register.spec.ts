/**
 * Unit tests for OAuth2 Dynamic Client Registration endpoint
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RegisterEndpoint } from '../../../../../../src/server/external/rest/oauth2/register';
import { logger } from '../../../../../../src/utils/logger';
import type { Request, Response } from 'express';

// Mock dependencies
vi.mock('../../../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-123')
}));

describe('RegisterEndpoint', () => {
  let registerEndpoint: RegisterEndpoint;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Clear registered clients
    const registeredClients = (RegisterEndpoint as any).registeredClients;
    if (registeredClients) {
      registeredClients.clear();
    }

    registerEndpoint = new RegisterEndpoint();
    
    mockReq = {
      body: {}
    };
    
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('register', () => {
    it('should register client with minimal required fields', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback']
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        client_id: 'mcp-mock-uuid-123',
        client_secret: 'mock-uuid-123',
        client_id_issued_at: expect.any(Number),
        client_secret_expires_at: 0,
        client_name: 'MCP Client',
        redirect_uris: ['http://localhost:3000/callback'],
        token_endpoint_auth_method: 'client_secret_basic',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: 'openid profile email'
      });

      expect(logger.info).toHaveBeenCalledWith('Client registered successfully', {
        clientId: 'mcp-mock-uuid-123',
        clientName: 'MCP Client',
        redirectUris: ['http://localhost:3000/callback']
      });
    });

    it('should register client with all optional fields', async () => {
      mockReq.body = {
        client_name: 'Test Application',
        client_uri: 'https://app.example.com',
        logo_uri: 'https://app.example.com/logo.png',
        redirect_uris: ['http://localhost:3000/callback', 'http://localhost:3000/auth'],
        token_endpoint_auth_method: 'client_secret_post',
        grant_types: ['authorization_code', 'refresh_token', 'client_credentials'],
        response_types: ['code', 'token'],
        scope: 'openid profile email read:data write:data',
        contacts: ['admin@example.com', 'support@example.com'],
        tos_uri: 'https://app.example.com/tos',
        policy_uri: 'https://app.example.com/privacy',
        jwks_uri: 'https://app.example.com/.well-known/jwks.json',
        software_id: 'test-software-v1',
        software_version: '1.0.0'
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        client_id: 'mcp-mock-uuid-123',
        client_secret: 'mock-uuid-123',
        client_id_issued_at: expect.any(Number),
        client_secret_expires_at: 0,
        client_name: 'Test Application',
        client_uri: 'https://app.example.com',
        logo_uri: 'https://app.example.com/logo.png',
        redirect_uris: ['http://localhost:3000/callback', 'http://localhost:3000/auth'],
        token_endpoint_auth_method: 'client_secret_post',
        grant_types: ['authorization_code', 'refresh_token', 'client_credentials'],
        response_types: ['code', 'token'],
        scope: 'openid profile email read:data write:data',
        contacts: ['admin@example.com', 'support@example.com'],
        tos_uri: 'https://app.example.com/tos',
        policy_uri: 'https://app.example.com/privacy',
        jwks_uri: 'https://app.example.com/.well-known/jwks.json',
        software_id: 'test-software-v1',
        software_version: '1.0.0'
      });
    });

    it('should reject registration without redirect_uris', async () => {
      mockReq.body = {
        client_name: 'Test App'
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'invalid_redirect_uri',
        error_description: 'At least one redirect_uri is required'
      });
    });

    it('should reject registration with empty redirect_uris array', async () => {
      mockReq.body = {
        redirect_uris: []
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'invalid_redirect_uri',
        error_description: 'At least one redirect_uri is required'
      });
    });

    it('should handle registration errors', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback']
      };

      // Force an error
      const error = new Error('Database error');
      vi.mocked(logger.info).mockImplementationOnce(() => {
        throw error;
      });

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(logger.error).toHaveBeenCalledWith('Client registration failed', { error });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'server_error',
        error_description: 'An error occurred during client registration'
      });
    });
  });

  describe('getClient', () => {
    it('should retrieve registered client', () => {
      // Register a client first
      const registration = {
        redirect_uris: ['http://localhost:3000/callback']
      };
      const registeredClient = RegisterEndpoint.registerClient(registration);

      const client = RegisterEndpoint.getClient(registeredClient.client_id);

      expect(client).toBeDefined();
      expect(client?.client_id).toBe(registeredClient.client_id);
    });

    it('should return undefined for non-existent client', () => {
      const client = RegisterEndpoint.getClient('non-existent-client');

      expect(client).toBeUndefined();
    });
  });

  describe('validateClient', () => {
    it('should validate client with correct credentials', () => {
      // Register a client first
      const registration = {
        redirect_uris: ['http://localhost:3000/callback']
      };
      const registeredClient = RegisterEndpoint.registerClient(registration);

      const isValid = RegisterEndpoint.validateClient(
        registeredClient.client_id,
        registeredClient.client_secret
      );

      expect(isValid).toBe(true);
    });

    it('should reject client with incorrect secret', () => {
      // Register a client first
      const registration = {
        redirect_uris: ['http://localhost:3000/callback']
      };
      const registeredClient = RegisterEndpoint.registerClient(registration);

      const isValid = RegisterEndpoint.validateClient(
        registeredClient.client_id,
        'wrong-secret'
      );

      expect(isValid).toBe(false);
    });

    it('should reject non-existent client', () => {
      const isValid = RegisterEndpoint.validateClient('non-existent-client', 'any-secret');

      expect(isValid).toBe(false);
    });

    it('should validate public client without secret', () => {
      // Register a public client
      const registration = {
        redirect_uris: ['http://localhost:3000/callback'],
        token_endpoint_auth_method: 'none'
      };
      const registeredClient = RegisterEndpoint.registerClient(registration);

      const isValid = RegisterEndpoint.validateClient(registeredClient.client_id);

      expect(isValid).toBe(true);
    });

    it('should validate public client even with wrong secret', () => {
      // Register a public client
      const registration = {
        redirect_uris: ['http://localhost:3000/callback'],
        token_endpoint_auth_method: 'none'
      };
      const registeredClient = RegisterEndpoint.registerClient(registration);

      const isValid = RegisterEndpoint.validateClient(
        registeredClient.client_id,
        'any-secret'
      );

      expect(isValid).toBe(true);
    });
  });

  describe('registerClient', () => {
    it('should register client programmatically with custom client_id', () => {
      const registration = {
        client_id: 'custom-client-id',
        client_name: 'Custom Client',
        redirect_uris: ['http://localhost:3000/callback']
      };

      const client = RegisterEndpoint.registerClient(registration);

      expect(client.client_id).toBe('custom-client-id');
      expect(client.client_name).toBe('Custom Client');
      expect(client.client_secret).toBe('mock-uuid-123');
    });

    it('should register public client without secret', () => {
      const registration = {
        client_name: 'Public Client',
        redirect_uris: ['http://localhost:3000/callback'],
        token_endpoint_auth_method: 'none'
      };

      const client = RegisterEndpoint.registerClient(registration);

      expect(client.client_secret).toBeUndefined();
      expect(client.token_endpoint_auth_method).toBe('none');
    });

    it('should use defaults for missing fields', () => {
      const registration = {};

      const client = RegisterEndpoint.registerClient(registration);

      expect(client.client_id).toBe('mcp-mock-uuid-123');
      expect(client.client_name).toBe('OAuth Client');
      expect(client.redirect_uris).toEqual([]);
      expect(client.token_endpoint_auth_method).toBe('client_secret_basic');
      expect(client.grant_types).toEqual(['authorization_code']);
      expect(client.response_types).toEqual(['code']);
      expect(client.scope).toBe('openid profile email');
    });

    it('should set timestamps correctly', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      
      const registration = {
        redirect_uris: ['http://localhost:3000/callback']
      };
      const client = RegisterEndpoint.registerClient(registration);
      
      const afterTime = Math.floor(Date.now() / 1000);

      expect(client.client_id_issued_at).toBeGreaterThanOrEqual(beforeTime);
      expect(client.client_id_issued_at).toBeLessThanOrEqual(afterTime);
      expect(client.client_secret_expires_at).toBe(0); // Never expires
    });
  });
});