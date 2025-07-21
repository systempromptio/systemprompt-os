/**
 * @fileoverview Unit tests for OAuth2 error utilities
 * @module tests/unit/server/external/rest/oauth2
 */

import { describe, it, expect } from 'vitest';
import { OAuth2Error, OAuth2ErrorType } from '@/server/external/rest/oauth2/errors.js';

describe('OAuth2 Errors', () => {
  describe('OAuth2ErrorType Enum', () => {
    it('should have correct error type values', () => {
      expect(OAuth2ErrorType.InvalidRequest).toBe('invalid_request');
      expect(OAuth2ErrorType.InvalidClient).toBe('invalid_client');
      expect(OAuth2ErrorType.InvalidGrant).toBe('invalid_grant');
      expect(OAuth2ErrorType.UnauthorizedClient).toBe('unauthorized_client');
      expect(OAuth2ErrorType.UnsupportedGrantType).toBe('unsupported_grant_type');
      expect(OAuth2ErrorType.UnsupportedResponseType).toBe('unsupported_response_type');
      expect(OAuth2ErrorType.InvalidScope).toBe('invalid_scope');
      expect(OAuth2ErrorType.AccessDenied).toBe('access_denied');
      expect(OAuth2ErrorType.ServerError).toBe('server_error');
    });
  });

  describe('OAuth2Error Class', () => {
    it('should create error with type and description', () => {
      const error = new OAuth2Error(OAuth2ErrorType.InvalidRequest, 'Missing required parameter');
      
      expect(error.name).toBe('OAuth2Error');
      expect(error.errorType).toBe(OAuth2ErrorType.InvalidRequest);
      expect(error.errorDescription).toBe('Missing required parameter');
      expect(error.code).toBe(400);
      expect(error.message).toBe('Missing required parameter');
    });

    it('should use error type as message when description is not provided', () => {
      const error = new OAuth2Error(OAuth2ErrorType.InvalidGrant);
      
      expect(error.message).toBe('invalid_grant');
      expect(error.errorDescription).toBeUndefined();
    });

    it('should accept custom error code', () => {
      const error = new OAuth2Error(OAuth2ErrorType.InvalidClient, 'Bad client', 401);
      
      expect(error.code).toBe(401);
    });

    it('should include error URI when provided', () => {
      const error = new OAuth2Error(
        OAuth2ErrorType.InvalidScope,
        'Scope not allowed',
        400,
        'https://example.com/docs/errors#invalid_scope'
      );
      
      expect(error.errorUri).toBe('https://example.com/docs/errors#invalid_scope');
    });

    describe('toJSON', () => {
      it('should serialize to OAuth2ErrorResponse format', () => {
        const error = new OAuth2Error(OAuth2ErrorType.InvalidRequest, 'Missing code');
        const json = error.toJSON();
        
        expect(json).toEqual({
          error: 'invalid_request',
          error_description: 'Missing code'
        });
      });

      it('should omit undefined fields', () => {
        const error = new OAuth2Error(OAuth2ErrorType.ServerError);
        const json = error.toJSON();
        
        expect(json).toEqual({
          error: 'server_error'
        });
        expect(json).not.toHaveProperty('error_description');
        expect(json).not.toHaveProperty('error_uri');
      });

      it('should include error_uri when present', () => {
        const error = new OAuth2Error(
          OAuth2ErrorType.InvalidScope,
          'Invalid scope requested',
          400,
          'https://docs.example.com/oauth2/scopes'
        );
        const json = error.toJSON();
        
        expect(json).toEqual({
          error: 'invalid_scope',
          error_description: 'Invalid scope requested',
          error_uri: 'https://docs.example.com/oauth2/scopes'
        });
      });
    });

    describe('Static factory methods', () => {
      it('should create InvalidRequest error', () => {
        const error = OAuth2Error.invalidRequest('Missing parameter');
        
        expect(error.errorType).toBe(OAuth2ErrorType.InvalidRequest);
        expect(error.errorDescription).toBe('Missing parameter');
        expect(error.code).toBe(400);
      });

      it('should create InvalidClient error with 401 code', () => {
        const error = OAuth2Error.invalidClient('Unknown client');
        
        expect(error.errorType).toBe(OAuth2ErrorType.InvalidClient);
        expect(error.errorDescription).toBe('Unknown client');
        expect(error.code).toBe(401);
      });

      it('should create InvalidGrant error', () => {
        const error = OAuth2Error.invalidGrant('Code expired');
        
        expect(error.errorType).toBe(OAuth2ErrorType.InvalidGrant);
        expect(error.errorDescription).toBe('Code expired');
        expect(error.code).toBe(400);
      });

      it('should create UnauthorizedClient error', () => {
        const error = OAuth2Error.unauthorizedClient();
        
        expect(error.errorType).toBe(OAuth2ErrorType.UnauthorizedClient);
        expect(error.code).toBe(400);
      });

      it('should create UnsupportedGrantType error', () => {
        const error = OAuth2Error.unsupportedGrantType('Grant type not supported');
        
        expect(error.errorType).toBe(OAuth2ErrorType.UnsupportedGrantType);
        expect(error.errorDescription).toBe('Grant type not supported');
      });

      it('should create UnsupportedResponseType error', () => {
        const error = OAuth2Error.unsupportedResponseType();
        
        expect(error.errorType).toBe(OAuth2ErrorType.UnsupportedResponseType);
        expect(error.code).toBe(400);
      });

      it('should create InvalidScope error', () => {
        const error = OAuth2Error.invalidScope('Scope too broad');
        
        expect(error.errorType).toBe(OAuth2ErrorType.InvalidScope);
        expect(error.errorDescription).toBe('Scope too broad');
      });

      it('should create AccessDenied error', () => {
        const error = OAuth2Error.accessDenied('User denied access');
        
        expect(error.errorType).toBe(OAuth2ErrorType.AccessDenied);
        expect(error.errorDescription).toBe('User denied access');
      });

      it('should create ServerError with 500 code', () => {
        const error = OAuth2Error.serverError('Internal error');
        
        expect(error.errorType).toBe(OAuth2ErrorType.ServerError);
        expect(error.errorDescription).toBe('Internal error');
        expect(error.code).toBe(500);
      });
    });

    it('should be instanceof Error', () => {
      const error = new OAuth2Error(OAuth2ErrorType.InvalidRequest);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OAuth2Error);
    });
  });
});