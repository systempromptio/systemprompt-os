/**
 * @fileoverview Unit tests for OAuth2 error utilities
 * @module tests/unit/server/external/rest/oauth2
 */

import { describe, it, expect } from 'vitest';
import { OAuth2Error } from '@/server/external/rest/oauth2/errors.js';
import { OAuth2ErrorTypeEnum } from '@/server/external/rest/oauth2/types/errors.types.js';

describe('OAuth2 Errors', () => {
  describe('OAuth2ErrorTypeEnum', () => {
    it('should have correct error type values', () => {
      expect(OAuth2ErrorTypeEnum.INVALID_REQUEST).toBe('invalid_request');
      expect(OAuth2ErrorTypeEnum.INVALID_CLIENT).toBe('invalid_client');
      expect(OAuth2ErrorTypeEnum.INVALID_GRANT).toBe('invalid_grant');
      expect(OAuth2ErrorTypeEnum.UNAUTHORIZED_CLIENT).toBe('unauthorized_client');
      expect(OAuth2ErrorTypeEnum.UNSUPPORTED_GRANT_TYPE).toBe('unsupported_grant_type');
      expect(OAuth2ErrorTypeEnum.UNSUPPORTED_RESPONSE_TYPE).toBe('unsupported_response_type');
      expect(OAuth2ErrorTypeEnum.INVALID_SCOPE).toBe('invalid_scope');
      expect(OAuth2ErrorTypeEnum.ACCESS_DENIED).toBe('access_denied');
      expect(OAuth2ErrorTypeEnum.SERVER_ERROR).toBe('servererror');
    });
  });

  describe('OAuth2Error Class', () => {
    it('should create error with type and description', () => {
      const error = new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_REQUEST, 'Missing required parameter');

      expect(error.name).toBe('OAuth2Error');
      expect(error.errorType).toBe(OAuth2ErrorTypeEnum.INVALID_REQUEST);
      expect(error.errorDescription).toBe('Missing required parameter');
      expect(error.code).toBe(400);
      expect(error.message).toBe('Missing required parameter');
    });

    it('should use error type as message when description is not provided', () => {
      const error = new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_GRANT);

      expect(error.message).toBe('invalid_grant');
      expect(error.errorDescription).toBeUndefined();
    });

    it('should accept custom error code', () => {
      const error = new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_CLIENT, 'Bad client', 401);

      expect(error.code).toBe(401);
    });

    it('should not have errorUri property by default', () => {
      const error = new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_SCOPE, 'Scope not allowed');

      expect(error.errorUri).toBeUndefined();
    });

    it('should handle undefined description explicitly', () => {
      const error = new OAuth2Error(OAuth2ErrorTypeEnum.ACCESS_DENIED, undefined);

      expect(error.message).toBe('access_denied');
      expect(error.errorDescription).toBeUndefined();
    });

    it('should handle null description by setting it explicitly', () => {
      const error = new OAuth2Error(OAuth2ErrorTypeEnum.ACCESS_DENIED, null as any);

      expect(error.message).toBe('access_denied');
      expect(error.errorDescription).toBe(null);
    });

    it('should handle empty string description', () => {
      const error = new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_SCOPE, '');

      expect(error.message).toBe('');
      expect(error.errorDescription).toBe('');
    });

    describe('toJSON', () => {
      it('should serialize to OAuth2ErrorResponse format', () => {
        const error = new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_REQUEST, 'Missing code');
        const json = error.toJSON();

        expect(json).toEqual({
          error: 'invalid_request',
          error_description: 'Missing code',
        });
      });

      it('should omit undefined fields', () => {
        const error = new OAuth2Error(OAuth2ErrorTypeEnum.SERVER_ERROR);
        const json = error.toJSON();

        expect(json).toEqual({
          error: 'servererror',
        });
        expect(json).not.toHaveProperty('error_description');
        expect(json).not.toHaveProperty('error_uri');
      });

      it('should include error_uri when manually set', () => {
        const error = new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_SCOPE, 'Invalid scope requested');
        // Manually set errorUri as it's not settable via constructor
        (error as any).errorUri = 'https://docs.example.com/oauth2/scopes';
        const json = error.toJSON();

        expect(json).toEqual({
          error: 'invalid_scope',
          error_description: 'Invalid scope requested',
          error_uri: 'https://docs.example.com/oauth2/scopes',
        });
      });

      it('should include empty string description when provided', () => {
        const error = new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_REQUEST, '');
        const json = error.toJSON();

        expect(json).toEqual({
          error: 'invalid_request',
          error_description: '',
        });
      });

      it('should include null description when provided', () => {
        const error = new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_REQUEST, null as any);
        const json = error.toJSON();

        expect(json).toEqual({
          error: 'invalid_request',
          error_description: null,
        });
      });
    });

    describe('Static factory methods', () => {
      it('should create InvalidRequest error with description', () => {
        const error = OAuth2Error.invalidRequest('Missing parameter');

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.INVALID_REQUEST);
        expect(error.errorDescription).toBe('Missing parameter');
        expect(error.code).toBe(400);
        expect(error.message).toBe('Missing parameter');
        expect(error.name).toBe('OAuth2Error');
      });

      it('should create InvalidRequest error without description', () => {
        const error = OAuth2Error.invalidRequest();

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.INVALID_REQUEST);
        expect(error.errorDescription).toBeUndefined();
        expect(error.code).toBe(400);
        expect(error.message).toBe('invalid_request');
      });

      it('should create InvalidClient error with 401 code and description', () => {
        const error = OAuth2Error.invalidClient('Unknown client');

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.INVALID_CLIENT);
        expect(error.errorDescription).toBe('Unknown client');
        expect(error.code).toBe(401);
        expect(error.message).toBe('Unknown client');
      });

      it('should create InvalidClient error without description', () => {
        const error = OAuth2Error.invalidClient();

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.INVALID_CLIENT);
        expect(error.errorDescription).toBeUndefined();
        expect(error.code).toBe(401);
        expect(error.message).toBe('invalid_client');
      });

      it('should create InvalidGrant error with description', () => {
        const error = OAuth2Error.invalidGrant('Code expired');

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.INVALID_GRANT);
        expect(error.errorDescription).toBe('Code expired');
        expect(error.code).toBe(400);
      });

      it('should create InvalidGrant error without description', () => {
        const error = OAuth2Error.invalidGrant();

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.INVALID_GRANT);
        expect(error.errorDescription).toBeUndefined();
        expect(error.code).toBe(400);
      });

      it('should create UnauthorizedClient error with description', () => {
        const error = OAuth2Error.unauthorizedClient('Client not authorized');

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.UNAUTHORIZED_CLIENT);
        expect(error.errorDescription).toBe('Client not authorized');
        expect(error.code).toBe(400);
      });

      it('should create UnauthorizedClient error without description', () => {
        const error = OAuth2Error.unauthorizedClient();

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.UNAUTHORIZED_CLIENT);
        expect(error.errorDescription).toBeUndefined();
        expect(error.code).toBe(400);
      });

      it('should create UnsupportedGrantType error with description', () => {
        const error = OAuth2Error.unsupportedGrantType('Grant type not supported');

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.UNSUPPORTED_GRANT_TYPE);
        expect(error.errorDescription).toBe('Grant type not supported');
        expect(error.code).toBe(400);
      });

      it('should create UnsupportedGrantType error without description', () => {
        const error = OAuth2Error.unsupportedGrantType();

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.UNSUPPORTED_GRANT_TYPE);
        expect(error.errorDescription).toBeUndefined();
        expect(error.code).toBe(400);
      });

      it('should create UnsupportedResponseType error with description', () => {
        const error = OAuth2Error.unsupportedResponseType('Response type not supported');

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.UNSUPPORTED_RESPONSE_TYPE);
        expect(error.errorDescription).toBe('Response type not supported');
        expect(error.code).toBe(400);
      });

      it('should create UnsupportedResponseType error without description', () => {
        const error = OAuth2Error.unsupportedResponseType();

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.UNSUPPORTED_RESPONSE_TYPE);
        expect(error.errorDescription).toBeUndefined();
        expect(error.code).toBe(400);
      });

      it('should create InvalidScope error with description', () => {
        const error = OAuth2Error.invalidScope('Scope too broad');

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.INVALID_SCOPE);
        expect(error.errorDescription).toBe('Scope too broad');
        expect(error.code).toBe(400);
      });

      it('should create InvalidScope error without description', () => {
        const error = OAuth2Error.invalidScope();

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.INVALID_SCOPE);
        expect(error.errorDescription).toBeUndefined();
        expect(error.code).toBe(400);
      });

      it('should create AccessDenied error with description', () => {
        const error = OAuth2Error.accessDenied('User denied access');

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.ACCESS_DENIED);
        expect(error.errorDescription).toBe('User denied access');
        expect(error.code).toBe(400);
      });

      it('should create AccessDenied error without description', () => {
        const error = OAuth2Error.accessDenied();

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.ACCESS_DENIED);
        expect(error.errorDescription).toBeUndefined();
        expect(error.code).toBe(400);
      });

      it('should create ServerError with 500 code and description', () => {
        const error = OAuth2Error.serverError('Internal error');

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.SERVER_ERROR);
        expect(error.errorDescription).toBe('Internal error');
        expect(error.code).toBe(500);
      });

      it('should create ServerError with 500 code without description', () => {
        const error = OAuth2Error.serverError();

        expect(error.errorType).toBe(OAuth2ErrorTypeEnum.SERVER_ERROR);
        expect(error.errorDescription).toBeUndefined();
        expect(error.code).toBe(500);
        expect(error.message).toBe('servererror');
      });

      it('should handle null values in static factory methods', () => {
        const invalidRequestError = OAuth2Error.invalidRequest(null as any);
        const invalidClientError = OAuth2Error.invalidClient(null as any);
        const serverError = OAuth2Error.serverError(null as any);

        expect(invalidRequestError.errorDescription).toBe(null);
        expect(invalidRequestError.code).toBe(400);
        expect(invalidClientError.errorDescription).toBe(null);
        expect(invalidClientError.code).toBe(401);
        expect(serverError.errorDescription).toBe(null);
        expect(serverError.code).toBe(500);
      });
    });

    it('should be instanceof Error', () => {
      const error = new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_REQUEST);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OAuth2Error);
    });

    it('should have correct property values', () => {
      const error = new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_REQUEST, 'Test description', 422);

      expect(error.code).toBe(422);
      expect(error.errorType).toBe(OAuth2ErrorTypeEnum.INVALID_REQUEST);
      expect(error.errorDescription).toBe('Test description');
      expect(error.errorUri).toBeUndefined();
      expect(error.name).toBe('OAuth2Error');
      expect(error.message).toBe('Test description');
    });

    it('should handle all enum values in constructor', () => {
      const enumValues = Object.values(OAuth2ErrorTypeEnum);
      
      for (const errorType of enumValues) {
        const error = new OAuth2Error(errorType, `Test ${errorType}`, 400);
        expect(error.errorType).toBe(errorType);
        expect(error.errorDescription).toBe(`Test ${errorType}`);
        expect(error.message).toBe(`Test ${errorType}`);
        expect(error.code).toBe(400);
      }
    });
  });
});
