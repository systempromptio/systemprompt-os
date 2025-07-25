/**
 * @fileoverview Unit tests for OAuth2 UserInfo endpoint
 * @module tests/unit/server/external/rest/oauth2/userinfo
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import {
  UserInfoEndpoint,
  type UserInfo,
} from '../../../../../../src/server/external/rest/oauth2/userinfo.js';
import { OAuth2Error } from '../../../../../../src/server/external/rest/oauth2/errors.js';
import { AuthRepository } from '../../../../../../src/modules/core/auth/database/repository.js';
import type { IUser } from '../../../../../../src/modules/core/auth/types/index.js';

// Mock AuthRepository
const mockAuthRepo = {
  getInstance: vi.fn(),
  getIUserById: vi.fn(),
};

vi.mock('../../../../../../src/modules/core/auth/database/repository.js', () => ({
  AuthRepository: {
    getInstance: vi.fn(() => mockAuthRepo),
  },
}));

// Mock OAuth2Error
vi.mock('../../../../../../src/server/external/rest/oauth2/errors.js', () => ({
  OAuth2Error: {
    unauthorizedClient: vi.fn(),
    invalidRequest: vi.fn(),
  },
}));

// Request interface with user property
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    sub: string;
    clientid: string;
    scope?: string;
  };
}

describe('UserInfoEndpoint', () => {
  let endpoint: UserInfoEndpoint;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  // Mock error objects
  const mockUnauthorizedError = {
    code: 401,
    toJSON: vi.fn(() => ({ error: 'unauthorized_client', error_description: 'Unauthorized' })),
  };
  
  const mockInvalidRequestError = {
    code: 400,
    toJSON: vi.fn(() => ({ error: 'invalid_request', error_description: 'User not found' })),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup OAuth2Error mocks
    (OAuth2Error.unauthorizedClient as ReturnType<typeof vi.fn>).mockReturnValue(mockUnauthorizedError);
    (OAuth2Error.invalidRequest as ReturnType<typeof vi.fn>).mockReturnValue(mockInvalidRequestError);

    endpoint = new UserInfoEndpoint();

    jsonMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock }));

    mockReq = {
      user: {
        id: 'user123',
        sub: 'user123',
        clientid: 'client123',
        scope: 'openid profile email',
      },
    };

    mockRes = {
      json: jsonMock,
      status: statusMock,
    };

    // Setup default successful user response
    mockAuthRepo.getIUserById.mockResolvedValue({
      id: 'user123',
      email: 'user123@example.com',
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      roles: [],
      permissions: [],
    } as IUser);
  });

  describe('getUserInfo', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockReq.user = undefined;

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(OAuth2Error.unauthorizedClient).toHaveBeenCalledWith('Unauthorized');
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'unauthorized_client',
        error_description: 'Unauthorized',
      });
    });

    it('returns 400 when user is not found in database', async () => {
      mockAuthRepo.getIUserById.mockResolvedValue(null);

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(AuthRepository.getInstance).toHaveBeenCalled();
      expect(mockAuthRepo.getIUserById).toHaveBeenCalledWith('user123');
      expect(OAuth2Error.invalidRequest).toHaveBeenCalledWith('User not found');
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'invalid_request',
        error_description: 'User not found',
      });
    });

    it('returns basic user info with openid scope only', async () => {
      mockReq.user!.scope = 'openid';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'user123',
      });
    });

    it('handles undefined scope', async () => {
      mockReq.user!.scope = undefined;

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'user123',
      });
    });

    it('handles empty string scope', async () => {
      mockReq.user!.scope = '';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'user123',
      });
    });

    it('includes profile information when profile scope is present', async () => {
      mockReq.user!.scope = 'openid profile';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'user123',
        name: 'Test User',
        preferred_username: 'user123',
        picture: 'https://example.com/avatar.jpg',
      });
    });

    it('includes email information when email scope is present', async () => {
      mockReq.user!.scope = 'openid email';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'user123',
        email: 'user123@example.com',
        email_verified: true,
      });
    });

    it('includes agent information when agent scope is present', async () => {
      mockReq.user!.scope = 'openid agent';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'user123',
        agent_id: 'agent-user123',
        agent_type: 'autonomous',
      });
    });

    it('includes all information when all scopes are present', async () => {
      mockReq.user!.scope = 'openid profile email agent';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'user123',
        name: 'Test User',
        preferred_username: 'user123',
        picture: 'https://example.com/avatar.jpg',
        email: 'user123@example.com',
        email_verified: true,
        agent_id: 'agent-user123',
        agent_type: 'autonomous',
      });
    });

    it('handles user without name field', async () => {
      mockAuthRepo.getIUserById.mockResolvedValue({
        id: 'user123',
        email: 'user123@example.com',
        // name: undefined (missing)
        avatarUrl: 'https://example.com/avatar.jpg',
        isActive: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        roles: [],
        permissions: [],
      } as IUser);
      
      mockReq.user!.scope = 'openid profile';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'user123',
        preferred_username: 'user123',
        picture: 'https://example.com/avatar.jpg',
      });
    });

    it('handles user without avatarUrl field', async () => {
      mockAuthRepo.getIUserById.mockResolvedValue({
        id: 'user123',
        email: 'user123@example.com',
        name: 'Test User',
        // avatarUrl: undefined (missing)
        isActive: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        roles: [],
        permissions: [],
      } as IUser);
      
      mockReq.user!.scope = 'openid profile';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'user123',
        name: 'Test User',
        preferred_username: 'user123',
      });
    });

    it('handles email without @ symbol', async () => {
      mockAuthRepo.getIUserById.mockResolvedValue({
        id: 'user123',
        email: 'invalidemailformat',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        isActive: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        roles: [],
        permissions: [],
      } as IUser);
      
      mockReq.user!.scope = 'openid profile email';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.preferred_username).toBe('invalidemailformat');
      expect(response.email).toBe('invalidemailformat');
    });

    it('handles email with multiple @ symbols', async () => {
      mockAuthRepo.getIUserById.mockResolvedValue({
        id: 'user123',
        email: 'user@sub@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        isActive: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        roles: [],
        permissions: [],
      } as IUser);
      
      mockReq.user!.scope = 'openid profile email';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.preferred_username).toBe('user');
      expect(response.email).toBe('user@sub@example.com');
    });

    it('handles multiple scopes separated by spaces', async () => {
      mockReq.user!.scope = 'openid   profile  email'; // Multiple spaces

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response).toHaveProperty('sub');
      expect(response).toHaveProperty('name');
      expect(response).toHaveProperty('email');
    });

    it('handles different user ID', async () => {
      mockReq.user!.id = 'differentUser456';
      mockAuthRepo.getIUserById.mockResolvedValue({
        id: 'differentUser456',
        email: 'different@example.com',
        name: 'Different User',
        avatarUrl: 'https://example.com/different.jpg',
        isActive: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        roles: [],
        permissions: [],
      } as IUser);
      
      mockReq.user!.scope = 'openid profile email';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockAuthRepo.getIUserById).toHaveBeenCalledWith('differentUser456');
      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'differentUser456',
        name: 'Different User',
        preferred_username: 'different',
        picture: 'https://example.com/different.jpg',
        email: 'different@example.com',
        email_verified: true,
      });
    });

    it('ignores unknown scopes', async () => {
      mockReq.user!.scope = 'openid unknown_scope profile invalid_scope';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response).toHaveProperty('sub');
      expect(response).toHaveProperty('name');
      expect(response).not.toHaveProperty('unknown_scope');
      expect(response).not.toHaveProperty('invalid_scope');
    });

    it('only includes scope-specific data in response', async () => {
      // Test that agent_id and agent_type are not included without agent scope
      mockReq.user!.scope = 'openid profile email';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response).not.toHaveProperty('agent_id');
      expect(response).not.toHaveProperty('agent_type');
    });

    it('tests all conditional branches in scope checking', async () => {
      // Test with only agent scope to ensure other branches are not taken
      mockReq.user!.scope = 'openid agent';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response).toHaveProperty('sub');
      expect(response).toHaveProperty('agent_id');
      expect(response).toHaveProperty('agent_type');
      expect(response).not.toHaveProperty('name');
      expect(response).not.toHaveProperty('email');
      expect(response).not.toHaveProperty('preferred_username');
      expect(response).not.toHaveProperty('picture');
      expect(response).not.toHaveProperty('email_verified');
    });

    it('verifies AuthRepository singleton is called', async () => {
      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(AuthRepository.getInstance).toHaveBeenCalled();
      expect(mockAuthRepo.getIUserById).toHaveBeenCalledWith('user123');
    });

    it('handles empty email parts correctly', async () => {
      mockAuthRepo.getIUserById.mockResolvedValue({
        id: 'user123',
        email: '@example.com', // Email starting with @
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        isActive: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        roles: [],
        permissions: [],
      } as IUser);
      
      mockReq.user!.scope = 'openid profile email';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.email).toBe('@example.com');
      // Empty string before @ is falsy, so preferred_username won't be included
      expect(response).not.toHaveProperty('preferred_username');
    });

    it('tests email_verified is always true', async () => {
      mockReq.user!.scope = 'openid email';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.email_verified).toBe(true);
    });

    it('tests agent_id generation format', async () => {
      mockReq.user!.scope = 'openid agent';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.agent_id).toBe('agent-user123');
      expect(response.agent_type).toBe('autonomous');
    });

    it('ensures profile scope conditional checks work correctly', async () => {
      // Test that profile scope includes name, preferred_username, and picture when available
      mockReq.user!.scope = 'profile'; // Missing openid to test edge case

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      // Should still include sub even without openid scope
      expect(response.sub).toBe('user123');
      expect(response.name).toBe('Test User');
      expect(response.preferred_username).toBe('user123');
      expect(response.picture).toBe('https://example.com/avatar.jpg');
    });

    it('ensures email scope conditional checks work correctly', async () => {
      // Test that email scope includes email and email_verified when available
      mockReq.user!.scope = 'email'; // Missing openid to test edge case

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.sub).toBe('user123');
      expect(response.email).toBe('user123@example.com');
      expect(response.email_verified).toBe(true);
    });

    it('ensures agent scope conditional checks work correctly', async () => {
      // Test that agent scope includes agent_id and agent_type when available
      mockReq.user!.scope = 'agent'; // Missing openid to test edge case

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.sub).toBe('user123');
      expect(response.agent_id).toBe('agent-user123');
      expect(response.agent_type).toBe('autonomous');
    });

    it('handles database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockAuthRepo.getIUserById.mockRejectedValue(dbError);

      await expect(endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response))
        .rejects.toThrow('Database connection failed');
    });

    it('handles user with empty email string', async () => {
      mockAuthRepo.getIUserById.mockResolvedValue({
        id: 'user123',
        email: '', // Empty email string
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        isActive: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        roles: [],
        permissions: [],
      } as IUser);
      
      mockReq.user!.scope = 'openid email';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      // Empty email is falsy, so it won't be included in response
      expect(response).not.toHaveProperty('email');
      expect(response.sub).toBe('user123');
    });

    it('handles user with null name field', async () => {
      mockAuthRepo.getIUserById.mockResolvedValue({
        id: 'user123',
        email: 'user123@example.com',
        name: null, // Explicitly null
        avatarUrl: 'https://example.com/avatar.jpg',
        isActive: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        roles: [],
        permissions: [],
      } as any);
      
      mockReq.user!.scope = 'openid profile';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.sub).toBe('user123');
      expect(response.preferred_username).toBe('user123');
      // Null name is falsy, so it won't be included in response
      expect(response).not.toHaveProperty('name');
    });

    it('handles user with null avatarUrl field', async () => {
      mockAuthRepo.getIUserById.mockResolvedValue({
        id: 'user123',
        email: 'user123@example.com',
        name: 'Test User',
        avatarUrl: null, // Explicitly null
        isActive: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        roles: [],
        permissions: [],
      } as any);
      
      mockReq.user!.scope = 'openid profile';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.sub).toBe('user123');
      expect(response.name).toBe('Test User');
      expect(response.preferred_username).toBe('user123');
      // Null avatarUrl is falsy, so it won't be included in response
      expect(response).not.toHaveProperty('picture');
    });

    it('verifies email_verified undefined check branch', async () => {
      // Create a userInfo object where email_verified could theoretically be undefined
      // Although in the current implementation it's always true, we test the conditional
      mockReq.user!.scope = 'openid email';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.email_verified).toBe(true);
      expect(typeof response.email_verified).toBe('boolean');
    });

    it('handles scope with mixed case', async () => {
      mockReq.user!.scope = 'openid PROFILE Email';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      // Mixed case scopes won't match due to case sensitivity
      expect(response.sub).toBe('user123');
      expect(response).not.toHaveProperty('name');
      expect(response).not.toHaveProperty('email');
    });

    it('handles scope string with trailing/leading spaces', async () => {
      mockReq.user!.scope = '  openid profile email  ';

      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      // Trailing/leading spaces will create empty string elements, but won't affect matching
      expect(response.sub).toBe('user123');
      expect(response.name).toBe('Test User');
      expect(response.email).toBe('user123@example.com');
    });

    it('tests constructor creates new instances', () => {
      const endpoint1 = new UserInfoEndpoint();
      const endpoint2 = new UserInfoEndpoint();
      
      expect(endpoint1).toBeInstanceOf(UserInfoEndpoint);
      expect(endpoint2).toBeInstanceOf(UserInfoEndpoint);
      expect(endpoint1).not.toBe(endpoint2);
      expect(typeof endpoint1.getUserInfo).toBe('function');
      expect(typeof endpoint2.getUserInfo).toBe('function');
    });
  });
});