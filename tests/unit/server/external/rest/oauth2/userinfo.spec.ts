/**
 * @fileoverview Unit tests for OAuth2 UserInfo endpoint
 * @module tests/unit/server/external/rest/oauth2/userinfo
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { UserInfoEndpoint, AuthenticatedRequest } from '../../../../../../src/server/external/rest/oauth2/userinfo';
import { OAuth2Error } from '../../../../../../src/server/external/rest/oauth2/errors';

// Mock OAuth2Error
vi.mock('../../../../../../src/server/external/rest/oauth2/errors', () => ({
  OAuth2Error: {
    unauthorizedClient: vi.fn(() => ({
      code: 401,
      toJSON: () => ({ error: 'unauthorized_client', error_description: 'Unauthorized' })
    }))
  }
}));

// Create mock instance
const mockAuthRepo = {
  getUserById: vi.fn((userId) => ({
    id: userId,
    email: `${userId}@systemprompt.local`,
    name: `User ${userId}`,
    avatarUrl: undefined
  })),
  getUserRoles: vi.fn(() => [{ name: 'user' }])
};

// Mock database
vi.mock('@/modules/core/database/index.js', () => ({
  getDatabase: vi.fn(() => ({}))
}));

// Mock auth repository
vi.mock('@/modules/core/auth/database/repository.js', () => ({
  AuthRepository: vi.fn(() => mockAuthRepo)
}));

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

describe('UserInfoEndpoint', () => {
  let endpoint: UserInfoEndpoint;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let jsonMock: any;
  let statusMock: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    endpoint = new UserInfoEndpoint();
    
    jsonMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock }));
    
    mockReq = {
      user: {
        id: 'user123',
        sub: 'user123',
        clientid: 'client123',
        scope: 'openid profile email'
      }
    };
    
    mockRes = {
      json: jsonMock,
      status: statusMock
    };
  });
  
  describe('getUserInfo', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockReq.user = undefined;
      
      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);
      
      expect(OAuth2Error.unauthorizedClient).toHaveBeenCalledWith('Unauthorized');
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'unauthorized_client',
        error_description: 'Unauthorized'
      });
    });
    
    it('returns basic user info with openid scope only', async () => {
      mockReq.user!.scope = 'openid';
      
      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'user123'
      });
    });
    
    it('includes profile information when profile scope is present', async () => {
      mockReq.user!.scope = 'openid profile';
      
      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'user123',
        name: 'User user123',
        preferred_username: 'user123',
        picture: undefined
      });
    });
    
    it('includes email information when email scope is present', async () => {
      mockReq.user!.scope = 'openid email';
      
      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'user123',
        email: 'user123@systemprompt.local',
        email_verified: true
      });
    });
    
    it('includes agent information when agent scope is present', async () => {
      mockReq.user!.scope = 'openid agent';
      
      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'user123',
        agent_id: 'agent-user123',
        agent_type: 'autonomous'
      });
    });
    
    it('includes all information when all scopes are present', async () => {
      mockReq.user!.scope = 'openid profile email agent';
      
      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'user123',
        name: 'User user123',
        preferred_username: 'user123',
        picture: undefined,
        email: 'user123@systemprompt.local',
        email_verified: true,
        agent_id: 'agent-user123',
        agent_type: 'autonomous'
      });
    });
    
    it('handles multiple scopes separated by spaces', async () => {
      mockReq.user!.scope = 'openid   profile  email'; // Multiple spaces
      
      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);
      
      const response = (mockRes.json as any).mock.calls[0][0];
      expect(response).toHaveProperty('sub');
      expect(response).toHaveProperty('name');
      expect(response).toHaveProperty('email');
    });
    
    it('generates consistent user info based on sub', async () => {
      mockReq.user!.id = 'differentUser456';
      mockReq.user!.sub = 'differentUser456';
      mockReq.user!.scope = 'openid profile email';
      
      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        sub: 'differentUser456',
        name: 'User differentUser456',
        preferred_username: 'differentUser456',
        picture: undefined,
        email: 'differentUser456@systemprompt.local',
        email_verified: true
      });
    });
    
    it('ignores unknown scopes', async () => {
      mockReq.user!.scope = 'openid unknown_scope profile invalid_scope';
      
      await endpoint.getUserInfo(mockReq as AuthenticatedRequest, mockRes as Response);
      
      const response = (mockRes.json as any).mock.calls[0][0];
      expect(response).toHaveProperty('sub');
      expect(response).toHaveProperty('name');
      expect(response).not.toHaveProperty('unknown_scope');
      expect(response).not.toHaveProperty('invalid_scope');
    });
  });
});