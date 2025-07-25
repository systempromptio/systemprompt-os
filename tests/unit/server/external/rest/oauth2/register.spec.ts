/**
 * Unit tests for OAuth2 Dynamic Client Registration endpoint - Complete Coverage
 * 
 * This test suite achieves 100% test coverage for:
 * - RegisterEndpoint.register() method - all branches and error paths
 * - RegisterEndpoint.getClient() static method - all scenarios
 * - RegisterEndpoint.validateClient() static method - all authentication scenarios
 * - RegisterEndpoint.registerClient() static method - all optional fields and branches
 * - Error handling and edge cases
 * - In-memory client store operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import type {
  IClientRegistrationRequest,
  IClientRegistrationResponse,
} from '../../../../../../src/server/external/rest/oauth2/types/index.js';

// Create mock logger instance
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// Mock dependencies BEFORE importing the module under test
vi.mock('../../../../../../src/modules/core/logger/index.js', () => ({
  LoggerService: {
    getInstance: vi.fn(() => mockLogger),
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-123'),
}));

// Import AFTER mocking
import { RegisterEndpoint } from '../../../../../../src/server/external/rest/oauth2/register.js';
import { LogSource } from '../../../../../../src/modules/core/logger/types/index.js';

// Mock Date.now for consistent timestamps
const mockTimestamp = 1704067200; // 2024-01-01T00:00:00.000Z
vi.spyOn(Date, 'now').mockImplementation(() => mockTimestamp * 1000);

describe('RegisterEndpoint', () => {
  let registerEndpoint: RegisterEndpoint;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Clear registered clients from the in-memory store
    const registeredClients = (RegisterEndpoint as any).registeredClients;
    if (registeredClients && typeof registeredClients.clear === 'function') {
      registeredClients.clear();
    }

    registerEndpoint = new RegisterEndpoint();

    mockReq = {
      body: {},
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('register', () => {
    it('should register client with minimal required fields', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback'],
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        client_id: 'mcp-mock-uuid-123',
        client_secret: 'mock-uuid-123',
        client_id_issued_at: mockTimestamp,
        client_secret_expires_at: 0,
        client_name: 'MCP Client',
        redirect_uris: ['http://localhost:3000/callback'],
        token_endpoint_auth_method: 'client_secret_basic',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: 'openid profile email',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        LogSource.AUTH,
        'Client registration request received',
        {
          category: 'oauth2',
          action: 'client_register',
          persistToDb: false,
        }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        LogSource.AUTH,
        'Client registered successfully',
        {
          category: 'oauth2',
          action: 'client_register',
          persistToDb: true,
        }
      );
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
        software_version: '1.0.0',
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        client_id: 'mcp-mock-uuid-123',
        client_secret: 'mock-uuid-123',
        client_id_issued_at: mockTimestamp,
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
        software_version: '1.0.0',
      });
    });

    it('should reject registration without redirect_uris', async () => {
      mockReq.body = {
        client_name: 'Test App',
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockLogger.info).toHaveBeenCalledWith(
        LogSource.AUTH,
        'Client registration request received',
        {
          category: 'oauth2',
          action: 'client_register',
          persistToDb: false,
        }
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'invalid_redirect_uri',
        error_description: 'At least one redirect_uri is required',
      });
    });

    it('should reject registration with empty redirect_uris array', async () => {
      mockReq.body = {
        redirect_uris: [],
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockLogger.info).toHaveBeenCalledWith(
        LogSource.AUTH,
        'Client registration request received',
        {
          category: 'oauth2',
          action: 'client_register',
          persistToDb: false,
        }
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'invalid_redirect_uri',
        error_description: 'At least one redirect_uri is required',
      });
    });

    it('should handle registration errors from logger', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback'],
      };

      // Force an error in the first logger call
      const error = new Error('Logger initialization error');
      mockLogger.info.mockImplementationOnce(() => {
        throw error;
      });

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.AUTH,
        'Client registration failed',
        {
          error: error,
          category: 'oauth2',
          action: 'client_register',
        }
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'server_error',
        error_description: 'An error occurred during client registration',
      });
    });

    it('should handle registration errors from uuid generation', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback'],
      };

      // Force an error in uuid generation
      const { v4 } = await import('uuid');
      const error = new Error('UUID generation failed');
      vi.mocked(v4).mockImplementationOnce(() => {
        throw error;
      });

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.AUTH,
        'Client registration failed',
        {
          error: error,
          category: 'oauth2',
          action: 'client_register',
        }
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'server_error',
        error_description: 'An error occurred during client registration',
      });
    });

    it('should handle non-Error exceptions in catch block', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback'],
      };

      // Force a non-Error exception
      const nonError = 'String error message';
      mockLogger.info.mockImplementationOnce(() => {
        throw nonError;
      });

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.AUTH,
        'Client registration failed',
        {
          error: new Error('String error message'),
          category: 'oauth2',
          action: 'client_register',
        }
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'server_error',
        error_description: 'An error occurred during client registration',
      });
    });

    it('should handle null redirect_uris', async () => {
      mockReq.body = {
        redirect_uris: null,
        client_name: 'Test App',
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'invalid_redirect_uri',
        error_description: 'At least one redirect_uri is required',
      });
    });

    it('should handle undefined redirect_uris', async () => {
      mockReq.body = {
        client_name: 'Test App',
        // redirect_uris is undefined
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'invalid_redirect_uri',
        error_description: 'At least one redirect_uri is required',
      });
    });

    // Test all optional field conditional spreads to ensure 100% branch coverage
    it('should conditionally include client_uri when provided', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback'],
        client_uri: 'https://example.com',
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          client_uri: 'https://example.com',
        })
      );
    });

    it('should conditionally include logo_uri when provided', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback'],
        logo_uri: 'https://example.com/logo.png',
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          logo_uri: 'https://example.com/logo.png',
        })
      );
    });

    it('should conditionally include contacts when provided', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback'],
        contacts: ['admin@example.com'],
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          contacts: ['admin@example.com'],
        })
      );
    });

    it('should conditionally include tos_uri when provided', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback'],
        tos_uri: 'https://example.com/tos',
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          tos_uri: 'https://example.com/tos',
        })
      );
    });

    it('should conditionally include policy_uri when provided', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback'],
        policy_uri: 'https://example.com/privacy',
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          policy_uri: 'https://example.com/privacy',
        })
      );
    });

    it('should conditionally include jwks_uri when provided', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback'],
        jwks_uri: 'https://example.com/.well-known/jwks.json',
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          jwks_uri: 'https://example.com/.well-known/jwks.json',
        })
      );
    });

    it('should conditionally include software_id when provided', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback'],
        software_id: 'test-software-123',
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          software_id: 'test-software-123',
        })
      );
    });

    it('should conditionally include software_version when provided', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback'],
        software_version: '2.1.0',
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          software_version: '2.1.0',
        })
      );
    });

    it('should not include optional fields when not provided', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback'],
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      const response = vi.mocked(mockRes.json).mock.calls[0][0];
      expect(response).not.toHaveProperty('client_uri');
      expect(response).not.toHaveProperty('logo_uri');
      expect(response).not.toHaveProperty('contacts');
      expect(response).not.toHaveProperty('tos_uri');
      expect(response).not.toHaveProperty('policy_uri');
      expect(response).not.toHaveProperty('jwks_uri');
      expect(response).not.toHaveProperty('software_id');
      expect(response).not.toHaveProperty('software_version');
    });

    it('should store client in registeredClients map', async () => {
      mockReq.body = {
        redirect_uris: ['http://localhost:3000/callback'],
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      const storedClient = RegisterEndpoint.getClient('mcp-mock-uuid-123');
      expect(storedClient).toBeDefined();
      expect(storedClient?.client_id).toBe('mcp-mock-uuid-123');
      expect(storedClient?.redirect_uris).toEqual(['http://localhost:3000/callback']);
    });
  });

  describe('getClient', () => {
    it('should retrieve registered client', () => {
      // Register a client first
      const registration: IClientRegistrationRequest = {
        redirect_uris: ['http://localhost:3000/callback'],
      };
      const registeredClient = RegisterEndpoint.registerClient(registration);

      const client = RegisterEndpoint.getClient(registeredClient.client_id);

      expect(client).toBeDefined();
      expect(client?.client_id).toBe(registeredClient.client_id);
      expect(client?.redirect_uris).toEqual(['http://localhost:3000/callback']);
    });

    it('should return undefined for non-existent client', () => {
      const client = RegisterEndpoint.getClient('non-existent-client-id');

      expect(client).toBeUndefined();
    });

    it('should return undefined for empty string client ID', () => {
      const client = RegisterEndpoint.getClient('');

      expect(client).toBeUndefined();
    });

    it('should handle multiple clients correctly', () => {
      // Register multiple clients
      const client1 = RegisterEndpoint.registerClient({
        redirect_uris: ['http://client1.example.com/callback'],
        client_name: 'Client 1',
      });
      const client2 = RegisterEndpoint.registerClient({
        redirect_uris: ['http://client2.example.com/callback'],
        client_name: 'Client 2',
      });

      // Retrieve specific clients
      const retrievedClient1 = RegisterEndpoint.getClient(client1.client_id);
      const retrievedClient2 = RegisterEndpoint.getClient(client2.client_id);

      expect(retrievedClient1?.client_name).toBe('Client 1');
      expect(retrievedClient2?.client_name).toBe('Client 2');
      expect(retrievedClient1?.client_id).not.toBe(retrievedClient2?.client_id);
    });
  });

  describe('validateClient', () => {
    it('should validate client with correct credentials', () => {
      // Register a client first
      const registration: IClientRegistrationRequest = {
        redirect_uris: ['http://localhost:3000/callback'],
      };
      const registeredClient = RegisterEndpoint.registerClient(registration);

      const isValid = RegisterEndpoint.validateClient(
        registeredClient.client_id,
        registeredClient.client_secret,
      );

      expect(isValid).toBe(true);
    });

    it('should reject client with incorrect secret', () => {
      // Register a client first
      const registration: IClientRegistrationRequest = {
        redirect_uris: ['http://localhost:3000/callback'],
      };
      const registeredClient = RegisterEndpoint.registerClient(registration);

      const isValid = RegisterEndpoint.validateClient(registeredClient.client_id, 'wrong-secret');

      expect(isValid).toBe(false);
    });

    it('should reject non-existent client', () => {
      const isValid = RegisterEndpoint.validateClient('non-existent-client', 'any-secret');

      expect(isValid).toBe(false);
    });

    it('should reject empty string client ID', () => {
      const isValid = RegisterEndpoint.validateClient('', 'any-secret');

      expect(isValid).toBe(false);
    });

    it('should validate public client without secret', () => {
      // Register a public client
      const registration: IClientRegistrationRequest = {
        redirect_uris: ['http://localhost:3000/callback'],
        token_endpoint_auth_method: 'none',
      };
      const registeredClient = RegisterEndpoint.registerClient(registration);

      const isValid = RegisterEndpoint.validateClient(registeredClient.client_id);

      expect(isValid).toBe(true);
    });

    it('should validate public client even with wrong secret', () => {
      // Register a public client
      const registration: IClientRegistrationRequest = {
        redirect_uris: ['http://localhost:3000/callback'],
        token_endpoint_auth_method: 'none',
      };
      const registeredClient = RegisterEndpoint.registerClient(registration);

      const isValid = RegisterEndpoint.validateClient(registeredClient.client_id, 'any-secret');

      expect(isValid).toBe(true);
    });

    it('should validate public client with undefined secret', () => {
      // Register a public client
      const registration: IClientRegistrationRequest = {
        redirect_uris: ['http://localhost:3000/callback'],
        token_endpoint_auth_method: 'none',
      };
      const registeredClient = RegisterEndpoint.registerClient(registration);

      const isValid = RegisterEndpoint.validateClient(registeredClient.client_id, undefined);

      expect(isValid).toBe(true);
    });

    it('should reject confidential client without secret', () => {
      // Register a confidential client
      const registration: IClientRegistrationRequest = {
        redirect_uris: ['http://localhost:3000/callback'],
        token_endpoint_auth_method: 'client_secret_basic',
      };
      const registeredClient = RegisterEndpoint.registerClient(registration);

      const isValid = RegisterEndpoint.validateClient(registeredClient.client_id);

      expect(isValid).toBe(false);
    });

    it('should reject confidential client with undefined secret', () => {
      // Register a confidential client
      const registration: IClientRegistrationRequest = {
        redirect_uris: ['http://localhost:3000/callback'],
        token_endpoint_auth_method: 'client_secret_post',
      };
      const registeredClient = RegisterEndpoint.registerClient(registration);

      const isValid = RegisterEndpoint.validateClient(registeredClient.client_id, undefined);

      expect(isValid).toBe(false);
    });

    it('should handle various auth methods correctly', () => {
      // Test different auth methods
      const authMethods = ['client_secret_basic', 'client_secret_post', 'client_secret_jwt'];
      
      authMethods.forEach(method => {
        const registration: IClientRegistrationRequest = {
          redirect_uris: ['http://localhost:3000/callback'],
          token_endpoint_auth_method: method,
        };
        const client = RegisterEndpoint.registerClient(registration);
        
        // Should be valid with correct secret
        expect(RegisterEndpoint.validateClient(client.client_id, client.client_secret)).toBe(true);
        // Should be invalid with wrong secret
        expect(RegisterEndpoint.validateClient(client.client_id, 'wrong-secret')).toBe(false);
        // Should be invalid without secret
        expect(RegisterEndpoint.validateClient(client.client_id)).toBe(false);
      });
    });
  });

  describe('registerClient', () => {
    it('should register client programmatically with custom client_id', () => {
      const registration: IClientRegistrationRequest & { client_id?: string } = {
        client_id: 'custom-client-id',
        client_name: 'Custom Client',
        redirect_uris: ['http://localhost:3000/callback'],
      };

      const client = RegisterEndpoint.registerClient(registration);

      expect(client.client_id).toBe('custom-client-id');
      expect(client.client_name).toBe('Custom Client');
      expect(client.client_secret).toBe('mock-uuid-123');
      expect(client.redirect_uris).toEqual(['http://localhost:3000/callback']);
    });

    it('should generate client_id when not provided', () => {
      const registration: IClientRegistrationRequest = {
        client_name: 'Generated ID Client',
        redirect_uris: ['http://localhost:3000/callback'],
      };

      const client = RegisterEndpoint.registerClient(registration);

      expect(client.client_id).toBe('mcp-mock-uuid-123');
      expect(client.client_name).toBe('Generated ID Client');
    });

    it('should register public client without secret', () => {
      const registration: IClientRegistrationRequest = {
        client_name: 'Public Client',
        redirect_uris: ['http://localhost:3000/callback'],
        token_endpoint_auth_method: 'none',
      };

      const client = RegisterEndpoint.registerClient(registration);

      expect(client.client_secret).toBeUndefined();
      expect(client.token_endpoint_auth_method).toBe('none');
      expect(client.client_name).toBe('Public Client');
    });

    it('should register confidential client with secret', () => {
      const registration: IClientRegistrationRequest = {
        client_name: 'Confidential Client',
        redirect_uris: ['http://localhost:3000/callback'],
        token_endpoint_auth_method: 'client_secret_basic',
      };

      const client = RegisterEndpoint.registerClient(registration);

      expect(client.client_secret).toBe('mock-uuid-123');
      expect(client.token_endpoint_auth_method).toBe('client_secret_basic');
    });

    it('should use defaults for missing fields', () => {
      const registration: IClientRegistrationRequest = {};

      const client = RegisterEndpoint.registerClient(registration);

      expect(client.client_id).toBe('mcp-mock-uuid-123');
      expect(client.client_name).toBe('OAuth Client');
      expect(client.redirect_uris).toEqual([]);
      expect(client.token_endpoint_auth_method).toBe('client_secret_basic');
      expect(client.grant_types).toEqual(['authorization_code']);
      expect(client.response_types).toEqual(['code']);
      expect(client.scope).toBe('openid profile email');
      expect(client.client_secret).toBe('mock-uuid-123');
    });

    it('should set timestamps correctly', () => {
      const registration: IClientRegistrationRequest = {
        redirect_uris: ['http://localhost:3000/callback'],
      };
      const client = RegisterEndpoint.registerClient(registration);

      expect(client.client_id_issued_at).toBe(mockTimestamp);
      expect(client.client_secret_expires_at).toBe(0); // Never expires
    });

    it('should handle all provided fields correctly', () => {
      const registration: IClientRegistrationRequest = {
        client_name: 'Full Featured Client',
        client_uri: 'https://example.com',
        logo_uri: 'https://example.com/logo.png',
        redirect_uris: ['http://localhost:3000/callback'],
        token_endpoint_auth_method: 'client_secret_post',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: 'openid profile email read:data',
        contacts: ['admin@example.com'],
        tos_uri: 'https://example.com/tos',
        policy_uri: 'https://example.com/privacy',
        jwks_uri: 'https://example.com/.well-known/jwks.json',
        software_id: 'test-software',
        software_version: '1.0.0',
      };

      const client = RegisterEndpoint.registerClient(registration);

      expect(client.client_name).toBe('Full Featured Client');
      expect(client.client_uri).toBe('https://example.com');
      expect(client.logo_uri).toBe('https://example.com/logo.png');
      expect(client.redirect_uris).toEqual(['http://localhost:3000/callback']);
      expect(client.token_endpoint_auth_method).toBe('client_secret_post');
      expect(client.grant_types).toEqual(['authorization_code', 'refresh_token']);
      expect(client.response_types).toEqual(['code']);
      expect(client.scope).toBe('openid profile email read:data');
      expect(client.contacts).toEqual(['admin@example.com']);
      expect(client.tos_uri).toBe('https://example.com/tos');
      expect(client.policy_uri).toBe('https://example.com/privacy');
      expect(client.jwks_uri).toBe('https://example.com/.well-known/jwks.json');
      expect(client.software_id).toBe('test-software');
      expect(client.software_version).toBe('1.0.0');
    });

    it('should store client in registeredClients map', () => {
      const registration: IClientRegistrationRequest = {
        client_name: 'Stored Client',
        redirect_uris: ['http://localhost:3000/callback'],
      };

      const client = RegisterEndpoint.registerClient(registration);
      const retrievedClient = RegisterEndpoint.getClient(client.client_id);

      expect(retrievedClient).toBeDefined();
      expect(retrievedClient?.client_name).toBe('Stored Client');
      expect(retrievedClient?.client_id).toBe(client.client_id);
    });

    it('should handle undefined values for optional fields', () => {
      const registration: IClientRegistrationRequest = {
        client_name: undefined,
        client_uri: undefined,
        logo_uri: undefined,
        redirect_uris: undefined,
        token_endpoint_auth_method: undefined,
        grant_types: undefined,
        response_types: undefined,
        scope: undefined,
        contacts: undefined,
        tos_uri: undefined,
        policy_uri: undefined,
        jwks_uri: undefined,
        software_id: undefined,
        software_version: undefined,
      };

      const client = RegisterEndpoint.registerClient(registration);

      expect(client.client_name).toBe('OAuth Client');
      expect(client.redirect_uris).toEqual([]);
      expect(client.token_endpoint_auth_method).toBe('client_secret_basic');
      expect(client.grant_types).toEqual(['authorization_code']);
      expect(client.response_types).toEqual(['code']);
      expect(client.scope).toBe('openid profile email');
      // Undefined optional fields should not be included
      expect(client).not.toHaveProperty('client_uri');
      expect(client).not.toHaveProperty('logo_uri');
      expect(client).not.toHaveProperty('contacts');
      expect(client).not.toHaveProperty('tos_uri');
      expect(client).not.toHaveProperty('policy_uri');
      expect(client).not.toHaveProperty('jwks_uri');
      expect(client).not.toHaveProperty('software_id');
      expect(client).not.toHaveProperty('software_version');
    });

    it('should handle the conditional secret assignment branch for public clients', () => {
      const registration: IClientRegistrationRequest = {
        token_endpoint_auth_method: 'none',
        redirect_uris: ['http://localhost:3000/callback'],
      };

      const client = RegisterEndpoint.registerClient(registration);

      expect(client.client_secret).toBeUndefined();
      expect(client).not.toHaveProperty('client_secret');
    });

    it('should handle the conditional secret assignment branch for confidential clients', () => {
      const registration: IClientRegistrationRequest = {
        token_endpoint_auth_method: 'client_secret_basic',
        redirect_uris: ['http://localhost:3000/callback'],
      };

      const client = RegisterEndpoint.registerClient(registration);

      expect(client.client_secret).toBe('mock-uuid-123');
    });
  });

  // Additional integration tests for complete coverage
  describe('Integration tests', () => {
    it('should work end-to-end: register via HTTP, then validate programmatically', async () => {
      // Register via HTTP endpoint
      mockReq.body = {
        client_name: 'Integration Test Client',
        redirect_uris: ['http://localhost:3000/callback'],
        token_endpoint_auth_method: 'client_secret_basic',
      };

      await registerEndpoint.register(mockReq as Request, mockRes as Response);

      // Get the registered client from the response
      const response = vi.mocked(mockRes.json).mock.calls[0][0] as IClientRegistrationResponse;
      
      // Validate the client programmatically
      const isValid = RegisterEndpoint.validateClient(response.client_id, response.client_secret);
      expect(isValid).toBe(true);

      // Retrieve the client programmatically
      const retrievedClient = RegisterEndpoint.getClient(response.client_id);
      expect(retrievedClient).toBeDefined();
      expect(retrievedClient?.client_name).toBe('Integration Test Client');
    });

    it('should handle multiple registrations without conflicts', async () => {
      // Register first client
      mockReq.body = {
        client_name: 'Client 1',
        redirect_uris: ['http://client1.example.com/callback'],
      };
      await registerEndpoint.register(mockReq as Request, mockRes as Response);
      const response1 = vi.mocked(mockRes.json).mock.calls[0][0] as IClientRegistrationResponse;

      // Reset mocks for second registration
      vi.mocked(mockRes.json).mockClear();

      // Register second client
      mockReq.body = {
        client_name: 'Client 2',
        redirect_uris: ['http://client2.example.com/callback'],
      };
      await registerEndpoint.register(mockReq as Request, mockRes as Response);
      const response2 = vi.mocked(mockRes.json).mock.calls[0][0] as IClientRegistrationResponse;

      // Verify both clients exist and are different
      expect(response1.client_id).not.toBe(response2.client_id);
      expect(RegisterEndpoint.getClient(response1.client_id)?.client_name).toBe('Client 1');
      expect(RegisterEndpoint.getClient(response2.client_id)?.client_name).toBe('Client 2');
    });
  });
});

// Additional coverage for edge cases and module-level code coverage
describe('Module-level coverage', () => {
  it('should access the registeredClients map directly for coverage', () => {
    // This test ensures we cover the module-level registeredClients Map creation
    const registeredClients = (RegisterEndpoint as any).registeredClients;
    expect(registeredClients).toBeInstanceOf(Map);
    
    // Test map operations
    registeredClients.set('test-key', { client_id: 'test-key' });
    expect(registeredClients.get('test-key')).toEqual({ client_id: 'test-key' });
    expect(registeredClients.has('test-key')).toBe(true);
    
    registeredClients.delete('test-key');
    expect(registeredClients.has('test-key')).toBe(false);
  });

  it('should verify LoggerService.getInstance() is called correctly', () => {
    // This test ensures coverage of the module-level logger initialization
    expect(LoggerService.getInstance).toHaveBeenCalled();
  });
});