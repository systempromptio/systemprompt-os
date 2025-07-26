/**
 * Unit tests for OAuth2 default client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LogSource } from '../../../../../../src/modules/core/logger/types/index.js';

// Mock LoggerService before importing the module under test
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
};

vi.mock('../../../../../../src/modules/core/logger/index', () => ({
  LoggerService: {
    getInstance: vi.fn(() => mockLogger)
  },
  LogSource: {
    AUTH: 'auth'
  }
}));

const mockGetClient = vi.fn();
const mockRegisterClient = vi.fn();

vi.mock('../../../../../../src/server/external/rest/oauth2/register', () => ({
  RegisterEndpoint: {
    getClient: mockGetClient,
    registerClient: mockRegisterClient
  }
}));

// Use dynamic import to allow module reset
let getDefaultOAuthClient: any;

describe('getDefaultOAuthClient', () => {
  const baseUrl = 'https://example.com';

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetClient.mockReset();
    mockRegisterClient.mockReset();
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
    mockLogger.debug.mockReset();
    
    // Reset modules to clear the default client cache
    vi.resetModules();
    
    // Re-import the module to reset its state
    const module = await import('../../../../../../src/server/external/rest/oauth2/default-client');
    getDefaultOAuthClient = module.getDefaultOAuthClient;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should create new default client when none exists', async () => {
    const mockRegisteredClient = {
      client_id: 'default-web-client',
      client_secret: undefined,
      redirect_uris: [
        'https://example.com/oauth2/callback/google',
        'https://example.com/oauth2/callback/github',
        'https://example.com/auth/callback'
      ],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: 'openid profile email',
      token_endpoint_auth_method: 'none'
    };

    mockGetClient.mockReturnValue(undefined);
    mockRegisterClient.mockResolvedValue(mockRegisteredClient);

    const client = await getDefaultOAuthClient(baseUrl);

    expect(mockGetClient).toHaveBeenCalledWith('default-web-client');
    expect(mockRegisterClient).toHaveBeenCalledWith({
      client_name: 'SystemPrompt Web Client',
      client_id: 'default-web-client',
      redirect_uris: [
        'https://example.com/oauth2/callback/google',
        'https://example.com/oauth2/callback/github',
        'https://example.com/auth/callback'
      ],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: 'openid profile email',
      token_endpoint_auth_method: 'none'
    });

    expect(client).toEqual({
      client_id: 'default-web-client',
      client_secret: '',
      redirect_uris: mockRegisteredClient.redirect_uris
    });

    expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Created default OAuth client', {
      category: 'oauth2',
      action: 'client_create',
      persistToDb: true
    });
  });

  it('should return existing default client', async () => {
    const existingClient = {
      client_id: 'default-web-client',
      client_secret: 'existing-secret',
      redirect_uris: [
        'https://example.com/oauth2/callback/google',
        'https://example.com/oauth2/callback/github'
      ],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      scope: 'openid profile',
      token_endpoint_auth_method: 'client_secret_basic'
    };

    mockGetClient.mockReturnValue(existingClient);

    const client = await getDefaultOAuthClient(baseUrl);

    expect(mockGetClient).toHaveBeenCalledWith('default-web-client');
    expect(mockRegisterClient).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();

    expect(client).toEqual({
      client_id: 'default-web-client',
      client_secret: 'existing-secret',
      redirect_uris: existingClient.redirect_uris
    });
  });

  it('should cache default client after creation', async () => {
    const mockRegisteredClient = {
      client_id: 'default-web-client',
      client_secret: undefined,
      redirect_uris: [
        'https://example.com/oauth2/callback/google',
        'https://example.com/oauth2/callback/github',
        'https://example.com/auth/callback'
      ]
    };

    mockGetClient.mockReturnValue(undefined);
    mockRegisterClient.mockResolvedValue(mockRegisteredClient);

    // First call
    const client1 = await getDefaultOAuthClient(baseUrl);
    
    // Reset mocks to verify second call doesn't create new client
    vi.clearAllMocks();
    
    // Second call - should use cached client
    const client2 = await getDefaultOAuthClient(baseUrl);

    expect(client1).toBe(client2); // Should be same object reference
    expect(mockGetClient).not.toHaveBeenCalled();
    expect(mockRegisterClient).not.toHaveBeenCalled();
  });

  it('should handle existing client with missing redirect_uris', async () => {
    const existingClient = {
      client_id: 'default-web-client',
      client_secret: 'secret',
      redirect_uris: undefined // Missing redirect_uris
    };

    mockGetClient.mockReturnValue(existingClient);

    const client = await getDefaultOAuthClient(baseUrl);

    expect(client).toEqual({
      client_id: 'default-web-client',
      client_secret: 'secret',
      redirect_uris: []
    });
  });

  it('should handle existing client with missing client_secret', async () => {
    const existingClient = {
      client_id: 'default-web-client',
      client_secret: undefined, // Missing client_secret
      redirect_uris: ['https://example.com/callback']
    };

    mockGetClient.mockReturnValue(existingClient);

    const client = await getDefaultOAuthClient(baseUrl);

    expect(client).toEqual({
      client_id: 'default-web-client',
      client_secret: '',
      redirect_uris: ['https://example.com/callback']
    });
  });

  it('should use different redirect URIs based on baseUrl', async () => {
    const customBaseUrl = 'http://localhost:3000';
    
    mockGetClient.mockReturnValue(undefined);
    mockRegisterClient.mockImplementation((registration) => {
      return Promise.resolve({
        ...registration,
        client_secret: undefined
      });
    });

    await getDefaultOAuthClient(customBaseUrl);

    expect(mockRegisterClient).toHaveBeenCalledWith(
      expect.objectContaining({
        redirect_uris: [
          'http://localhost:3000/oauth2/callback/google',
          'http://localhost:3000/oauth2/callback/github',
          'http://localhost:3000/auth/callback'
        ]
      })
    );
  });

  it('should throw error when registerClient fails', async () => {
    const error = new Error('Registration failed');
    mockGetClient.mockReturnValue(undefined);
    mockRegisterClient.mockRejectedValue(error);

    await expect(getDefaultOAuthClient(baseUrl)).rejects.toThrow('Registration failed');
    
    expect(mockGetClient).toHaveBeenCalledWith('default-web-client');
    expect(mockRegisterClient).toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('should handle empty baseUrl', async () => {
    const emptyBaseUrl = '';
    
    mockGetClient.mockReturnValue(undefined);
    mockRegisterClient.mockImplementation((registration) => {
      return Promise.resolve({
        ...registration,
        client_secret: undefined
      });
    });

    await getDefaultOAuthClient(emptyBaseUrl);

    expect(mockRegisterClient).toHaveBeenCalledWith(
      expect.objectContaining({
        redirect_uris: [
          '/oauth2/callback/google',
          '/oauth2/callback/github',
          '/auth/callback'
        ]
      })
    );
  });

  it('should handle baseUrl with trailing slash', async () => {
    const baseUrlWithSlash = 'https://example.com/';
    
    mockGetClient.mockReturnValue(undefined);
    mockRegisterClient.mockImplementation((registration) => {
      return Promise.resolve({
        ...registration,
        client_secret: undefined
      });
    });

    await getDefaultOAuthClient(baseUrlWithSlash);

    expect(mockRegisterClient).toHaveBeenCalledWith(
      expect.objectContaining({
        redirect_uris: [
          'https://example.com//oauth2/callback/google',
          'https://example.com//oauth2/callback/github',
          'https://example.com//auth/callback'
        ]
      })
    );
  });

  it('should handle existing client with null redirect_uris and client_secret', async () => {
    const existingClient = {
      client_id: 'default-web-client',
      client_secret: null,
      redirect_uris: null
    };

    mockGetClient.mockReturnValue(existingClient);

    const client = await getDefaultOAuthClient(baseUrl);

    expect(client).toEqual({
      client_id: 'default-web-client',
      client_secret: '',
      redirect_uris: []
    });
  });

  it('should handle registered client with all optional fields undefined', async () => {
    const mockRegisteredClient = {
      client_id: 'default-web-client',
      client_secret: undefined,
      redirect_uris: undefined
    };

    mockGetClient.mockReturnValue(undefined);
    mockRegisterClient.mockResolvedValue(mockRegisteredClient);

    const client = await getDefaultOAuthClient(baseUrl);

    expect(client).toEqual({
      client_id: 'default-web-client',
      client_secret: '',
      redirect_uris: []
    });

    expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Created default OAuth client', {
      category: 'oauth2',
      action: 'client_create',
      persistToDb: true
    });
  });

  it('should handle registered client with empty string client_secret', async () => {
    const mockRegisteredClient = {
      client_id: 'default-web-client',
      client_secret: '',
      redirect_uris: ['https://example.com/callback']
    };

    mockGetClient.mockReturnValue(undefined);
    mockRegisterClient.mockResolvedValue(mockRegisteredClient);

    const client = await getDefaultOAuthClient(baseUrl);

    expect(client).toEqual({
      client_id: 'default-web-client',
      client_secret: '',
      redirect_uris: ['https://example.com/callback']
    });
  });

  it('should handle registered client with empty redirect_uris array', async () => {
    const mockRegisteredClient = {
      client_id: 'default-web-client',
      client_secret: 'secret',
      redirect_uris: []
    };

    mockGetClient.mockReturnValue(undefined);
    mockRegisterClient.mockResolvedValue(mockRegisteredClient);

    const client = await getDefaultOAuthClient(baseUrl);

    expect(client).toEqual({
      client_id: 'default-web-client',
      client_secret: 'secret',
      redirect_uris: []
    });
  });

  it('should create new client with all required registration fields', async () => {
    mockGetClient.mockReturnValue(undefined);
    
    const mockRegisteredClient = {
      client_id: 'default-web-client',
      client_secret: 'generated-secret',
      redirect_uris: [
        'https://example.com/oauth2/callback/google',
        'https://example.com/oauth2/callback/github',
        'https://example.com/auth/callback'
      ]
    };

    mockRegisterClient.mockResolvedValue(mockRegisteredClient);

    await getDefaultOAuthClient(baseUrl);

    expect(mockRegisterClient).toHaveBeenCalledWith({
      client_name: 'SystemPrompt Web Client',
      client_id: 'default-web-client',
      redirect_uris: [
        'https://example.com/oauth2/callback/google',
        'https://example.com/oauth2/callback/github',
        'https://example.com/auth/callback'
      ],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: 'openid profile email',
      token_endpoint_auth_method: 'none'
    });
  });

  it('should not cache client if registration fails', async () => {
    const error = new Error('Registration failed');
    mockGetClient.mockReturnValue(undefined);
    mockRegisterClient.mockRejectedValue(error);

    // First call should fail
    await expect(getDefaultOAuthClient(baseUrl)).rejects.toThrow('Registration failed');
    
    // Reset mocks for second call
    vi.clearAllMocks();
    mockGetClient.mockReturnValue(undefined);
    mockRegisterClient.mockResolvedValue({
      client_id: 'default-web-client',
      client_secret: 'secret',
      redirect_uris: ['https://example.com/callback']
    });

    // Second call should attempt registration again (not use cache)
    await getDefaultOAuthClient(baseUrl);
    
    expect(mockGetClient).toHaveBeenCalledWith('default-web-client');
    expect(mockRegisterClient).toHaveBeenCalled();
  });
});