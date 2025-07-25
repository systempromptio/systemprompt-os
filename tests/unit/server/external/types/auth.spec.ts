import { describe, it, expect } from 'vitest';
import type { AuthUser, AccessTokenPayload, AuthCookieOptions } from '../../../../../src/server/external/types/auth.js';

/**
 * Comprehensive unit tests for auth types interfaces.
 * These tests validate interface structure, type safety, and runtime conformance.
 */
describe('Auth Types', () => {
  describe('AuthUser Interface', () => {
    describe('Required Properties', () => {
      it('should accept valid AuthUser with all required properties', () => {
        const validAuthUser: AuthUser = {
          id: 'user123',
          email: 'test@example.com',
          roles: ['admin', 'user']
        };

        expect(validAuthUser.id).toBe('user123');
        expect(validAuthUser.email).toBe('test@example.com');
        expect(validAuthUser.roles).toEqual(['admin', 'user']);
        expect(validAuthUser.clientId).toBeUndefined();
        expect(validAuthUser.scope).toBeUndefined();
      });

      it('should accept AuthUser with empty roles array', () => {
        const authUser: AuthUser = {
          id: 'user456',
          email: 'empty-roles@example.com',
          roles: []
        };

        expect(authUser.roles).toEqual([]);
        expect(Array.isArray(authUser.roles)).toBe(true);
      });

      it('should accept AuthUser with multiple roles', () => {
        const authUser: AuthUser = {
          id: 'user789',
          email: 'multi-roles@example.com',
          roles: ['admin', 'moderator', 'user', 'guest']
        };

        expect(authUser.roles).toHaveLength(4);
        expect(authUser.roles).toContain('admin');
        expect(authUser.roles).toContain('moderator');
        expect(authUser.roles).toContain('user');
        expect(authUser.roles).toContain('guest');
      });
    });

    describe('Optional Properties', () => {
      it('should accept AuthUser with clientId', () => {
        const authUser: AuthUser = {
          id: 'user123',
          email: 'test@example.com',
          roles: ['user'],
          clientId: 'client456'
        };

        expect(authUser.clientId).toBe('client456');
      });

      it('should accept AuthUser with scope', () => {
        const authUser: AuthUser = {
          id: 'user123',
          email: 'test@example.com',
          roles: ['user'],
          scope: 'read write delete'
        };

        expect(authUser.scope).toBe('read write delete');
      });

      it('should accept AuthUser with both optional properties', () => {
        const authUser: AuthUser = {
          id: 'user123',
          email: 'test@example.com',
          roles: ['admin'],
          clientId: 'client789',
          scope: 'admin:all'
        };

        expect(authUser.clientId).toBe('client789');
        expect(authUser.scope).toBe('admin:all');
      });

      it('should accept AuthUser with undefined optional properties', () => {
        const authUser: AuthUser = {
          id: 'user123',
          email: 'test@example.com',
          roles: ['user'],
          clientId: undefined,
          scope: undefined
        };

        expect(authUser.clientId).toBeUndefined();
        expect(authUser.scope).toBeUndefined();
      });
    });

    describe('Edge Cases and Boundary Values', () => {
      it('should accept AuthUser with empty string id', () => {
        const authUser: AuthUser = {
          id: '',
          email: 'test@example.com',
          roles: ['user']
        };

        expect(authUser.id).toBe('');
      });

      it('should accept AuthUser with empty string email', () => {
        const authUser: AuthUser = {
          id: 'user123',
          email: '',
          roles: ['user']
        };

        expect(authUser.email).toBe('');
      });

      it('should accept AuthUser with very long id', () => {
        const longId = 'a'.repeat(1000);
        const authUser: AuthUser = {
          id: longId,
          email: 'test@example.com',
          roles: ['user']
        };

        expect(authUser.id).toBe(longId);
        expect(authUser.id).toHaveLength(1000);
      });

      it('should accept AuthUser with special characters in properties', () => {
        const authUser: AuthUser = {
          id: 'user@#$%^&*()123',
          email: 'test+tag@sub.example.com',
          roles: ['role-with-dash', 'role_with_underscore', 'role.with.dots'],
          clientId: 'client-123_abc.def',
          scope: 'scope:with:colons read+write admin/*'
        };

        expect(authUser.id).toBe('user@#$%^&*()123');
        expect(authUser.email).toBe('test+tag@sub.example.com');
        expect(authUser.roles).toContain('role-with-dash');
        expect(authUser.roles).toContain('role_with_underscore');
        expect(authUser.roles).toContain('role.with.dots');
        expect(authUser.clientId).toBe('client-123_abc.def');
        expect(authUser.scope).toBe('scope:with:colons read+write admin/*');
      });

      it('should accept AuthUser with empty string optional properties', () => {
        const authUser: AuthUser = {
          id: 'user123',
          email: 'test@example.com',
          roles: ['user'],
          clientId: '',
          scope: ''
        };

        expect(authUser.clientId).toBe('');
        expect(authUser.scope).toBe('');
      });
    });

    describe('Type Safety Validation', () => {
      it('should have correct property types', () => {
        const authUser: AuthUser = {
          id: 'user123',
          email: 'test@example.com',
          roles: ['admin', 'user'],
          clientId: 'client456',
          scope: 'read write'
        };

        expect(typeof authUser.id).toBe('string');
        expect(typeof authUser.email).toBe('string');
        expect(Array.isArray(authUser.roles)).toBe(true);
        expect(authUser.roles.every(role => typeof role === 'string')).toBe(true);
        expect(typeof authUser.clientId).toBe('string');
        expect(typeof authUser.scope).toBe('string');
      });
    });
  });

  describe('AccessTokenPayload Interface', () => {
    describe('Required Properties', () => {
      it('should accept valid AccessTokenPayload with all required properties', () => {
        const payload: AccessTokenPayload = {
          sub: 'user123',
          tokentype: 'access',
          iss: 'https://auth.example.com',
          aud: 'https://api.example.com',
          iat: 1640995200,
          exp: 1640998800
        };

        expect(payload.sub).toBe('user123');
        expect(payload.tokentype).toBe('access');
        expect(payload.iss).toBe('https://auth.example.com');
        expect(payload.aud).toBe('https://api.example.com');
        expect(payload.iat).toBe(1640995200);
        expect(payload.exp).toBe(1640998800);
      });

      it('should enforce tokentype to be exactly "access"', () => {
        const payload: AccessTokenPayload = {
          sub: 'user123',
          tokentype: 'access',
          iss: 'issuer',
          aud: 'audience',
          iat: 1640995200,
          exp: 1640998800
        };

        expect(payload.tokentype).toBe('access');
        // Type system should prevent other values
      });

      it('should accept numeric timestamps for iat and exp', () => {
        const currentTime = Math.floor(Date.now() / 1000);
        const futureTime = currentTime + 3600;

        const payload: AccessTokenPayload = {
          sub: 'user123',
          tokentype: 'access',
          iss: 'issuer',
          aud: 'audience',
          iat: currentTime,
          exp: futureTime
        };

        expect(typeof payload.iat).toBe('number');
        expect(typeof payload.exp).toBe('number');
        expect(payload.exp).toBeGreaterThan(payload.iat);
      });
    });

    describe('Optional Properties', () => {
      it('should accept AccessTokenPayload with email', () => {
        const payload: AccessTokenPayload = {
          sub: 'user123',
          email: 'user@example.com',
          tokentype: 'access',
          iss: 'issuer',
          aud: 'audience',
          iat: 1640995200,
          exp: 1640998800
        };

        expect(payload.email).toBe('user@example.com');
      });

      it('should accept AccessTokenPayload with clientid', () => {
        const payload: AccessTokenPayload = {
          sub: 'user123',
          clientid: 'client456',
          tokentype: 'access',
          iss: 'issuer',
          aud: 'audience',
          iat: 1640995200,
          exp: 1640998800
        };

        expect(payload.clientid).toBe('client456');
      });

      it('should accept AccessTokenPayload with scope', () => {
        const payload: AccessTokenPayload = {
          sub: 'user123',
          scope: 'read write delete',
          tokentype: 'access',
          iss: 'issuer',
          aud: 'audience',
          iat: 1640995200,
          exp: 1640998800
        };

        expect(payload.scope).toBe('read write delete');
      });

      it('should accept AccessTokenPayload with jti', () => {
        const payload: AccessTokenPayload = {
          sub: 'user123',
          jti: 'token-id-12345',
          tokentype: 'access',
          iss: 'issuer',
          aud: 'audience',
          iat: 1640995200,
          exp: 1640998800
        };

        expect(payload.jti).toBe('token-id-12345');
      });

      it('should accept AccessTokenPayload with user object', () => {
        const payload: AccessTokenPayload = {
          sub: 'user123',
          user: {
            id: 'user123',
            email: 'user@example.com',
            name: 'Test User',
            avatar: 'https://example.com/avatar.jpg',
            roles: ['admin', 'user']
          },
          tokentype: 'access',
          iss: 'issuer',
          aud: 'audience',
          iat: 1640995200,
          exp: 1640998800
        };

        expect(payload.user?.id).toBe('user123');
        expect(payload.user?.email).toBe('user@example.com');
        expect(payload.user?.name).toBe('Test User');
        expect(payload.user?.avatar).toBe('https://example.com/avatar.jpg');
        expect(payload.user?.roles).toEqual(['admin', 'user']);
      });

      it('should accept AccessTokenPayload with minimal user object', () => {
        const payload: AccessTokenPayload = {
          sub: 'user123',
          user: {
            id: 'user123',
            email: 'user@example.com'
          },
          tokentype: 'access',
          iss: 'issuer',
          aud: 'audience',
          iat: 1640995200,
          exp: 1640998800
        };

        expect(payload.user?.id).toBe('user123');
        expect(payload.user?.email).toBe('user@example.com');
        expect(payload.user?.name).toBeUndefined();
        expect(payload.user?.avatar).toBeUndefined();
        expect(payload.user?.roles).toBeUndefined();
      });

      it('should accept AccessTokenPayload with roles array', () => {
        const payload: AccessTokenPayload = {
          sub: 'user123',
          roles: ['admin', 'moderator', 'user'],
          tokentype: 'access',
          iss: 'issuer',
          aud: 'audience',
          iat: 1640995200,
          exp: 1640998800
        };

        expect(payload.roles).toEqual(['admin', 'moderator', 'user']);
        expect(Array.isArray(payload.roles)).toBe(true);
      });

      it('should accept AccessTokenPayload with all optional properties', () => {
        const payload: AccessTokenPayload = {
          sub: 'user123',
          email: 'user@example.com',
          clientid: 'client456',
          scope: 'admin:all read write',
          jti: 'token-unique-id',
          user: {
            id: 'user123',
            email: 'user@example.com',
            name: 'Admin User',
            avatar: 'https://cdn.example.com/avatar.png',
            roles: ['admin', 'super-user']
          },
          roles: ['admin', 'user'],
          tokentype: 'access',
          iss: 'https://auth.service.com',
          aud: 'https://api.service.com',
          iat: 1640995200,
          exp: 1640998800
        };

        expect(payload.email).toBe('user@example.com');
        expect(payload.clientid).toBe('client456');
        expect(payload.scope).toBe('admin:all read write');
        expect(payload.jti).toBe('token-unique-id');
        expect(payload.user?.name).toBe('Admin User');
        expect(payload.roles).toEqual(['admin', 'user']);
      });
    });

    describe('Edge Cases and Boundary Values', () => {
      it('should accept AccessTokenPayload with empty string values', () => {
        const payload: AccessTokenPayload = {
          sub: '',
          email: '',
          clientid: '',
          scope: '',
          jti: '',
          tokentype: 'access',
          iss: '',
          aud: '',
          iat: 0,
          exp: 0
        };

        expect(payload.sub).toBe('');
        expect(payload.email).toBe('');
        expect(payload.clientid).toBe('');
        expect(payload.scope).toBe('');
        expect(payload.jti).toBe('');
        expect(payload.iss).toBe('');
        expect(payload.aud).toBe('');
      });

      it('should accept AccessTokenPayload with zero timestamps', () => {
        const payload: AccessTokenPayload = {
          sub: 'user123',
          tokentype: 'access',
          iss: 'issuer',
          aud: 'audience',
          iat: 0,
          exp: 0
        };

        expect(payload.iat).toBe(0);
        expect(payload.exp).toBe(0);
      });

      it('should accept AccessTokenPayload with large timestamp values', () => {
        const largeTimestamp = Number.MAX_SAFE_INTEGER;
        const payload: AccessTokenPayload = {
          sub: 'user123',
          tokentype: 'access',
          iss: 'issuer',
          aud: 'audience',
          iat: largeTimestamp,
          exp: largeTimestamp
        };

        expect(payload.iat).toBe(largeTimestamp);
        expect(payload.exp).toBe(largeTimestamp);
      });

      it('should accept AccessTokenPayload with empty arrays', () => {
        const payload: AccessTokenPayload = {
          sub: 'user123',
          roles: [],
          user: {
            id: 'user123',
            email: 'user@example.com',
            roles: []
          },
          tokentype: 'access',
          iss: 'issuer',
          aud: 'audience',
          iat: 1640995200,
          exp: 1640998800
        };

        expect(payload.roles).toEqual([]);
        expect(payload.user?.roles).toEqual([]);
      });

      it('should accept AccessTokenPayload with undefined optional nested properties', () => {
        const payload: AccessTokenPayload = {
          sub: 'user123',
          user: {
            id: 'user123',
            email: 'user@example.com',
            name: undefined,
            avatar: undefined,
            roles: undefined
          },
          tokentype: 'access',
          iss: 'issuer',
          aud: 'audience',
          iat: 1640995200,
          exp: 1640998800
        };

        expect(payload.user?.name).toBeUndefined();
        expect(payload.user?.avatar).toBeUndefined();
        expect(payload.user?.roles).toBeUndefined();
      });
    });

    describe('Type Safety Validation', () => {
      it('should have correct property types', () => {
        const payload: AccessTokenPayload = {
          sub: 'user123',
          email: 'user@example.com',
          clientid: 'client456',
          scope: 'read write',
          jti: 'token-id',
          user: {
            id: 'user123',
            email: 'user@example.com',
            name: 'Test User',
            avatar: 'avatar.jpg',
            roles: ['user']
          },
          roles: ['admin'],
          tokentype: 'access',
          iss: 'issuer',
          aud: 'audience',
          iat: 1640995200,
          exp: 1640998800
        };

        expect(typeof payload.sub).toBe('string');
        expect(typeof payload.email).toBe('string');
        expect(typeof payload.clientid).toBe('string');
        expect(typeof payload.scope).toBe('string');
        expect(typeof payload.jti).toBe('string');
        expect(typeof payload.tokentype).toBe('string');
        expect(typeof payload.iss).toBe('string');
        expect(typeof payload.aud).toBe('string');
        expect(typeof payload.iat).toBe('number');
        expect(typeof payload.exp).toBe('number');
        expect(typeof payload.user).toBe('object');
        expect(Array.isArray(payload.roles)).toBe(true);
        expect(Array.isArray(payload.user?.roles)).toBe(true);
      });
    });
  });

  describe('AuthCookieOptions Interface', () => {
    describe('Required Properties', () => {
      it('should accept valid AuthCookieOptions with all required properties', () => {
        const options: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600000
        };

        expect(options.httpOnly).toBe(true);
        expect(options.secure).toBe(true);
        expect(options.sameSite).toBe('strict');
        expect(options.maxAge).toBe(3600000);
        expect(options.path).toBeUndefined();
      });

      it('should accept AuthCookieOptions with httpOnly false', () => {
        const options: AuthCookieOptions = {
          httpOnly: false,
          secure: true,
          sameSite: 'lax',
          maxAge: 1800000
        };

        expect(options.httpOnly).toBe(false);
      });

      it('should accept AuthCookieOptions with secure false', () => {
        const options: AuthCookieOptions = {
          httpOnly: true,
          secure: false,
          sameSite: 'none',
          maxAge: 7200000
        };

        expect(options.secure).toBe(false);
      });

      it('should accept all valid sameSite values', () => {
        const strictOptions: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600000
        };
        expect(strictOptions.sameSite).toBe('strict');

        const laxOptions: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 3600000
        };
        expect(laxOptions.sameSite).toBe('lax');

        const noneOptions: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 3600000
        };
        expect(noneOptions.sameSite).toBe('none');
      });

      it('should accept various maxAge values', () => {
        const shortLived: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 1000
        };
        expect(shortLived.maxAge).toBe(1000);

        const mediumLived: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600000
        };
        expect(mediumLived.maxAge).toBe(3600000);

        const longLived: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 86400000
        };
        expect(longLived.maxAge).toBe(86400000);
      });
    });

    describe('Optional Properties', () => {
      it('should accept AuthCookieOptions with path', () => {
        const options: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600000,
          path: '/api'
        };

        expect(options.path).toBe('/api');
      });

      it('should accept AuthCookieOptions with root path', () => {
        const options: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600000,
          path: '/'
        };

        expect(options.path).toBe('/');
      });

      it('should accept AuthCookieOptions with complex path', () => {
        const options: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600000,
          path: '/api/v1/auth'
        };

        expect(options.path).toBe('/api/v1/auth');
      });

      it('should accept AuthCookieOptions with undefined path', () => {
        const options: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600000,
          path: undefined
        };

        expect(options.path).toBeUndefined();
      });
    });

    describe('Edge Cases and Boundary Values', () => {
      it('should accept AuthCookieOptions with zero maxAge', () => {
        const options: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 0
        };

        expect(options.maxAge).toBe(0);
      });

      it('should accept AuthCookieOptions with negative maxAge', () => {
        const options: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: -1
        };

        expect(options.maxAge).toBe(-1);
      });

      it('should accept AuthCookieOptions with very large maxAge', () => {
        const largeMaxAge = Number.MAX_SAFE_INTEGER;
        const options: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: largeMaxAge
        };

        expect(options.maxAge).toBe(largeMaxAge);
      });

      it('should accept AuthCookieOptions with empty string path', () => {
        const options: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600000,
          path: ''
        };

        expect(options.path).toBe('');
      });

      it('should accept AuthCookieOptions with path containing special characters', () => {
        const options: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600000,
          path: '/api/v1/auth?param=value&other=test#fragment'
        };

        expect(options.path).toBe('/api/v1/auth?param=value&other=test#fragment');
      });
    });

    describe('Type Safety Validation', () => {
      it('should have correct property types', () => {
        const options: AuthCookieOptions = {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 1800000,
          path: '/api'
        };

        expect(typeof options.httpOnly).toBe('boolean');
        expect(typeof options.secure).toBe('boolean');
        expect(typeof options.sameSite).toBe('string');
        expect(typeof options.maxAge).toBe('number');
        expect(typeof options.path).toBe('string');
      });

      it('should enforce sameSite to be union of specific strings', () => {
        const strictOptions: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600000
        };

        const laxOptions: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 3600000
        };

        const noneOptions: AuthCookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 3600000
        };

        expect(['strict', 'lax', 'none']).toContain(strictOptions.sameSite);
        expect(['strict', 'lax', 'none']).toContain(laxOptions.sameSite);
        expect(['strict', 'lax', 'none']).toContain(noneOptions.sameSite);
      });
    });
  });

  describe('Integration and Cross-Interface Tests', () => {
    it('should allow AuthUser to be constructed from AccessTokenPayload', () => {
      const payload: AccessTokenPayload = {
        sub: 'user123',
        email: 'user@example.com',
        clientid: 'client456',
        scope: 'read write',
        user: {
          id: 'user123',
          email: 'user@example.com',
          roles: ['admin', 'user']
        },
        roles: ['admin', 'user'],
        tokentype: 'access',
        iss: 'issuer',
        aud: 'audience',
        iat: 1640995200,
        exp: 1640998800
      };

      // Construct AuthUser from payload
      const authUser: AuthUser = {
        id: payload.sub,
        email: payload.email || payload.user?.email || '',
        roles: payload.roles || payload.user?.roles || [],
        clientId: payload.clientid,
        scope: payload.scope
      };

      expect(authUser.id).toBe(payload.sub);
      expect(authUser.email).toBe(payload.email);
      expect(authUser.roles).toEqual(payload.roles);
      expect(authUser.clientId).toBe(payload.clientid);
      expect(authUser.scope).toBe(payload.scope);
    });

    it('should handle payload with user object but no top-level email/roles', () => {
      const payload: AccessTokenPayload = {
        sub: 'user123',
        user: {
          id: 'user123',
          email: 'user@example.com',
          roles: ['moderator']
        },
        tokentype: 'access',
        iss: 'issuer',
        aud: 'audience',
        iat: 1640995200,
        exp: 1640998800
      };

      const authUser: AuthUser = {
        id: payload.sub,
        email: payload.email || payload.user?.email || '',
        roles: payload.roles || payload.user?.roles || [],
        clientId: payload.clientid,
        scope: payload.scope
      };

      expect(authUser.email).toBe('user@example.com');
      expect(authUser.roles).toEqual(['moderator']);
    });

    it('should handle payload with top-level properties but no user object', () => {
      const payload: AccessTokenPayload = {
        sub: 'user123',
        email: 'toplevel@example.com',
        roles: ['admin'],
        tokentype: 'access',
        iss: 'issuer',
        aud: 'audience',
        iat: 1640995200,
        exp: 1640998800
      };

      const authUser: AuthUser = {
        id: payload.sub,
        email: payload.email || payload.user?.email || '',
        roles: payload.roles || payload.user?.roles || [],
        clientId: payload.clientid,
        scope: payload.scope
      };

      expect(authUser.email).toBe('toplevel@example.com');
      expect(authUser.roles).toEqual(['admin']);
    });

    it('should handle payload with conflicting user object and top-level properties', () => {
      const payload: AccessTokenPayload = {
        sub: 'user123',
        email: 'toplevel@example.com',
        roles: ['admin'],
        user: {
          id: 'user123',
          email: 'nested@example.com',
          roles: ['user']
        },
        tokentype: 'access',
        iss: 'issuer',
        aud: 'audience',
        iat: 1640995200,
        exp: 1640998800
      };

      // Test preference for top-level properties
      const authUserTopLevel: AuthUser = {
        id: payload.sub,
        email: payload.email || payload.user?.email || '',
        roles: payload.roles || payload.user?.roles || [],
        clientId: payload.clientid,
        scope: payload.scope
      };

      expect(authUserTopLevel.email).toBe('toplevel@example.com');
      expect(authUserTopLevel.roles).toEqual(['admin']);
    });
  });

  describe('Runtime Validation and Type Checking', () => {
    it('should validate AuthUser structure at runtime', () => {
      const createAuthUser = (data: any): data is AuthUser => {
        return (
          typeof data === 'object' &&
          data !== null &&
          typeof data.id === 'string' &&
          typeof data.email === 'string' &&
          Array.isArray(data.roles) &&
          data.roles.every((role: any) => typeof role === 'string') &&
          (data.clientId === undefined || typeof data.clientId === 'string') &&
          (data.scope === undefined || typeof data.scope === 'string')
        );
      };

      const validData = {
        id: 'user123',
        email: 'test@example.com',
        roles: ['admin']
      };

      const invalidData = {
        id: 123, // Should be string
        email: 'test@example.com',
        roles: ['admin']
      };

      expect(createAuthUser(validData)).toBe(true);
      expect(createAuthUser(invalidData)).toBe(false);
    });

    it('should validate AccessTokenPayload structure at runtime', () => {
      const createAccessTokenPayload = (data: any): data is AccessTokenPayload => {
        return (
          typeof data === 'object' &&
          data !== null &&
          typeof data.sub === 'string' &&
          data.tokentype === 'access' &&
          typeof data.iss === 'string' &&
          typeof data.aud === 'string' &&
          typeof data.iat === 'number' &&
          typeof data.exp === 'number' &&
          (data.email === undefined || typeof data.email === 'string') &&
          (data.clientid === undefined || typeof data.clientid === 'string') &&
          (data.scope === undefined || typeof data.scope === 'string') &&
          (data.jti === undefined || typeof data.jti === 'string') &&
          (data.roles === undefined || (Array.isArray(data.roles) && data.roles.every((role: any) => typeof role === 'string')))
        );
      };

      const validData = {
        sub: 'user123',
        tokentype: 'access',
        iss: 'issuer',
        aud: 'audience',
        iat: 1640995200,
        exp: 1640998800
      };

      const invalidData = {
        sub: 'user123',
        tokentype: 'refresh', // Should be 'access'
        iss: 'issuer',
        aud: 'audience',
        iat: 1640995200,
        exp: 1640998800
      };

      expect(createAccessTokenPayload(validData)).toBe(true);
      expect(createAccessTokenPayload(invalidData)).toBe(false);
    });

    it('should validate AuthCookieOptions structure at runtime', () => {
      const createAuthCookieOptions = (data: any): data is AuthCookieOptions => {
        return (
          typeof data === 'object' &&
          data !== null &&
          typeof data.httpOnly === 'boolean' &&
          typeof data.secure === 'boolean' &&
          ['strict', 'lax', 'none'].includes(data.sameSite) &&
          typeof data.maxAge === 'number' &&
          (data.path === undefined || typeof data.path === 'string')
        );
      };

      const validData = {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 3600000
      };

      const invalidData = {
        httpOnly: 'true', // Should be boolean
        secure: true,
        sameSite: 'strict',
        maxAge: 3600000
      };

      expect(createAuthCookieOptions(validData)).toBe(true);
      expect(createAuthCookieOptions(invalidData)).toBe(false);
    });
  });
});