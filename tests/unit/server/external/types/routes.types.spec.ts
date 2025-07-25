/**
 * @fileoverview Unit tests for server external routes types
 * @module tests/unit/server/external/types
 */

import { describe, it, expect } from 'vitest';
import type {
  IRouteInfo,
  IExpressLayer,
  IExpressAppWithRouter,
  IRouteContext
} from '@/server/external/types/routes.types.js';

describe('Routes Types', () => {
  describe('IRouteInfo Interface', () => {
    it('should accept valid route info objects', () => {
      const validRouteInfo: IRouteInfo = {
        path: '/api/users',
        methods: ['GET', 'POST'],
        auth: 'bearer'
      };

      expect(validRouteInfo.path).toBe('/api/users');
      expect(validRouteInfo.methods).toEqual(['GET', 'POST']);
      expect(validRouteInfo.auth).toBe('bearer');
    });

    it('should accept route info with single method', () => {
      const singleMethodRoute: IRouteInfo = {
        path: '/health',
        methods: ['GET'],
        auth: 'none'
      };

      expect(singleMethodRoute.path).toBe('/health');
      expect(singleMethodRoute.methods).toHaveLength(1);
      expect(singleMethodRoute.methods[0]).toBe('GET');
      expect(singleMethodRoute.auth).toBe('none');
    });

    it('should accept route info with multiple methods', () => {
      const multiMethodRoute: IRouteInfo = {
        path: '/api/resource',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        auth: 'oauth2'
      };

      expect(multiMethodRoute.methods).toHaveLength(5);
      expect(multiMethodRoute.methods).toContain('GET');
      expect(multiMethodRoute.methods).toContain('POST');
      expect(multiMethodRoute.methods).toContain('PUT');
      expect(multiMethodRoute.methods).toContain('DELETE');
      expect(multiMethodRoute.methods).toContain('PATCH');
    });

    it('should accept route info with empty methods array', () => {
      const emptyMethodsRoute: IRouteInfo = {
        path: '/middleware',
        methods: [],
        auth: 'jwt'
      };

      expect(emptyMethodsRoute.methods).toHaveLength(0);
      expect(Array.isArray(emptyMethodsRoute.methods)).toBe(true);
    });

    it('should accept route info with root path', () => {
      const rootRoute: IRouteInfo = {
        path: '/',
        methods: ['GET'],
        auth: 'public'
      };

      expect(rootRoute.path).toBe('/');
    });

    it('should accept route info with complex path patterns', () => {
      const complexRoute: IRouteInfo = {
        path: '/api/v1/users/:id/posts/:postId',
        methods: ['GET', 'PUT'],
        auth: 'session'
      };

      expect(complexRoute.path).toBe('/api/v1/users/:id/posts/:postId');
    });

    it('should accept route info with wildcard paths', () => {
      const wildcardRoute: IRouteInfo = {
        path: '/static/*',
        methods: ['GET'],
        auth: 'none'
      };

      expect(wildcardRoute.path).toBe('/static/*');
    });

    it('should accept route info with query parameters in path', () => {
      const queryRoute: IRouteInfo = {
        path: '/search?q=:query',
        methods: ['GET'],
        auth: 'api_key'
      };

      expect(queryRoute.path).toBe('/search?q=:query');
    });
  });

  describe('IExpressLayer Interface', () => {
    it('should accept layer with route property', () => {
      const layerWithRoute: IExpressLayer = {
        route: {
          path: '/test',
          methods: { GET: true, POST: false }
        },
        name: 'testRoute',
        handle: {},
        regexp: {
          source: '^/test$'
        }
      };

      expect(layerWithRoute.route?.path).toBe('/test');
      expect(layerWithRoute.route?.methods.GET).toBe(true);
      expect(layerWithRoute.route?.methods.POST).toBe(false);
      expect(layerWithRoute.name).toBe('testRoute');
    });

    it('should accept layer without route property', () => {
      const layerWithoutRoute: IExpressLayer = {
        name: 'middleware',
        handle: {},
        regexp: {
          source: '^.*$'
        }
      };

      expect(layerWithoutRoute.route).toBeUndefined();
      expect(layerWithoutRoute.name).toBe('middleware');
    });

    it('should accept layer with nested stack in handle', () => {
      const nestedLayer: IExpressLayer = {
        name: 'router',
        handle: {
          stack: [
            {
              name: 'childRoute',
              handle: {},
              regexp: { source: '^/child$' }
            }
          ]
        },
        regexp: {
          source: '^/parent'
        }
      };

      expect(nestedLayer.handle.stack).toHaveLength(1);
      expect(nestedLayer.handle.stack?.[0]?.name).toBe('childRoute');
    });

    it('should accept layer with empty handle', () => {
      const emptyHandleLayer: IExpressLayer = {
        name: 'emptyHandler',
        handle: {},
        regexp: {
          source: '^/empty$'
        }
      };

      expect(emptyHandleLayer.handle.stack).toBeUndefined();
    });

    it('should accept layer with complex regex patterns', () => {
      const complexRegexLayer: IExpressLayer = {
        name: 'complexRoute',
        handle: {},
        regexp: {
          source: '^\/api\/v[0-9]+\/users\/([^\/]+)\/posts\/([^\/]+)\/?$'
        }
      };

      expect(complexRegexLayer.regexp.source).toBe('^\/api\/v[0-9]+\/users\/([^\/]+)\/posts\/([^\/]+)\/?$');
    });

    it('should accept layer with all HTTP methods enabled', () => {
      const allMethodsLayer: IExpressLayer = {
        route: {
          path: '/all-methods',
          methods: {
            GET: true,
            POST: true,
            PUT: true,
            DELETE: true,
            PATCH: true,
            HEAD: true,
            OPTIONS: true
          }
        },
        name: 'allMethods',
        handle: {},
        regexp: {
          source: '^/all-methods$'
        }
      };

      const methods = allMethodsLayer.route?.methods;
      expect(methods?.GET).toBe(true);
      expect(methods?.POST).toBe(true);
      expect(methods?.PUT).toBe(true);
      expect(methods?.DELETE).toBe(true);
      expect(methods?.PATCH).toBe(true);
      expect(methods?.HEAD).toBe(true);
      expect(methods?.OPTIONS).toBe(true);
    });

    it('should accept layer with mixed method states', () => {
      const mixedMethodsLayer: IExpressLayer = {
        route: {
          path: '/mixed',
          methods: {
            GET: true,
            POST: false,
            PUT: true,
            DELETE: false
          }
        },
        name: 'mixedMethods',
        handle: {},
        regexp: {
          source: '^/mixed$'
        }
      };

      const methods = mixedMethodsLayer.route?.methods;
      expect(methods?.GET).toBe(true);
      expect(methods?.POST).toBe(false);
      expect(methods?.PUT).toBe(true);
      expect(methods?.DELETE).toBe(false);
    });

    it('should accept deeply nested layer structure', () => {
      const deeplyNestedLayer: IExpressLayer = {
        name: 'rootRouter',
        handle: {
          stack: [
            {
              name: 'level1Router',
              handle: {
                stack: [
                  {
                    name: 'level2Route',
                    handle: {},
                    regexp: { source: '^/deep/route$' }
                  }
                ]
              },
              regexp: { source: '^/deep' }
            }
          ]
        },
        regexp: { source: '^/' }
      };

      const level1Stack = deeplyNestedLayer.handle.stack;
      expect(level1Stack).toHaveLength(1);
      
      const level2Stack = level1Stack?.[0]?.handle.stack;
      expect(level2Stack).toHaveLength(1);
      expect(level2Stack?.[0]?.name).toBe('level2Route');
    });
  });

  describe('IExpressAppWithRouter Interface', () => {
    it('should accept app with router stack', () => {
      const appWithRouter: IExpressAppWithRouter = {
        _router: {
          stack: [
            {
              name: 'route1',
              handle: {},
              regexp: { source: '^/route1$' }
            },
            {
              name: 'route2',
              handle: {},
              regexp: { source: '^/route2$' }
            }
          ]
        }
      };

      expect(appWithRouter._router?.stack).toHaveLength(2);
      expect(appWithRouter._router?.stack[0]?.name).toBe('route1');
      expect(appWithRouter._router?.stack[1]?.name).toBe('route2');
    });

    it('should accept app without router', () => {
      const appWithoutRouter: IExpressAppWithRouter = {};

      expect(appWithoutRouter._router).toBeUndefined();
    });

    it('should accept app with empty router stack', () => {
      const appWithEmptyStack: IExpressAppWithRouter = {
        _router: {
          stack: []
        }
      };

      expect(appWithEmptyStack._router?.stack).toHaveLength(0);
      expect(Array.isArray(appWithEmptyStack._router?.stack)).toBe(true);
    });

    it('should accept app with complex router stack', () => {
      const complexApp: IExpressAppWithRouter = {
        _router: {
          stack: [
            {
              route: {
                path: '/api/users',
                methods: { GET: true, POST: true }
              },
              name: 'usersRouter',
              handle: {
                stack: [
                  {
                    name: 'getUsersHandler',
                    handle: {},
                    regexp: { source: '^/api/users$' }
                  }
                ]
              },
              regexp: { source: '^/api/users' }
            },
            {
              name: 'staticMiddleware',
              handle: {},
              regexp: { source: '^/static' }
            }
          ]
        }
      };

      const stack = complexApp._router?.stack;
      expect(stack).toHaveLength(2);
      expect(stack?.[0]?.route?.path).toBe('/api/users');
      expect(stack?.[0]?.handle.stack).toHaveLength(1);
      expect(stack?.[1]?.name).toBe('staticMiddleware');
    });
  });

  describe('IRouteContext Interface', () => {
    it('should accept valid route context', () => {
      const validContext: IRouteContext = {
        routes: [
          {
            path: '/api/test',
            methods: ['GET'],
            auth: 'bearer'
          }
        ],
        prefix: '/api',
        authType: 'bearer'
      };

      expect(validContext.routes).toHaveLength(1);
      expect(validContext.routes[0]?.path).toBe('/api/test');
      expect(validContext.prefix).toBe('/api');
      expect(validContext.authType).toBe('bearer');
    });

    it('should accept context with empty routes array', () => {
      const emptyRoutesContext: IRouteContext = {
        routes: [],
        prefix: '',
        authType: 'none'
      };

      expect(emptyRoutesContext.routes).toHaveLength(0);
      expect(Array.isArray(emptyRoutesContext.routes)).toBe(true);
    });

    it('should accept context with multiple routes', () => {
      const multiRouteContext: IRouteContext = {
        routes: [
          {
            path: '/users',
            methods: ['GET', 'POST'],
            auth: 'jwt'
          },
          {
            path: '/posts',
            methods: ['GET'],
            auth: 'session'
          },
          {
            path: '/health',
            methods: ['GET'],
            auth: 'none'
          }
        ],
        prefix: '/api/v1',
        authType: 'mixed'
      };

      expect(multiRouteContext.routes).toHaveLength(3);
      expect(multiRouteContext.routes[0]?.methods).toEqual(['GET', 'POST']);
      expect(multiRouteContext.routes[1]?.auth).toBe('session');
      expect(multiRouteContext.routes[2]?.path).toBe('/health');
    });

    it('should accept context with empty prefix', () => {
      const noPrefixContext: IRouteContext = {
        routes: [
          {
            path: '/root',
            methods: ['GET'],
            auth: 'public'
          }
        ],
        prefix: '',
        authType: 'public'
      };

      expect(noPrefixContext.prefix).toBe('');
    });

    it('should accept context with root prefix', () => {
      const rootPrefixContext: IRouteContext = {
        routes: [
          {
            path: '/test',
            methods: ['GET'],
            auth: 'basic'
          }
        ],
        prefix: '/',
        authType: 'basic'
      };

      expect(rootPrefixContext.prefix).toBe('/');
    });

    it('should accept context with nested prefix', () => {
      const nestedPrefixContext: IRouteContext = {
        routes: [
          {
            path: '/deep/nested/route',
            methods: ['POST'],
            auth: 'oauth2'
          }
        ],
        prefix: '/api/v2/admin',
        authType: 'oauth2'
      };

      expect(nestedPrefixContext.prefix).toBe('/api/v2/admin');
    });

    it('should accept context with complex route configurations', () => {
      const complexContext: IRouteContext = {
        routes: [
          {
            path: '/api/users/:id',
            methods: ['GET', 'PUT', 'DELETE'],
            auth: 'bearer'
          },
          {
            path: '/api/users/:id/posts',
            methods: ['GET', 'POST'],
            auth: 'bearer'
          },
          {
            path: '/api/public/*',
            methods: ['GET'],
            auth: 'none'
          },
          {
            path: '/api/admin/dashboard',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            auth: 'admin'
          }
        ],
        prefix: '/v1',
        authType: 'mixed'
      };

      expect(complexContext.routes).toHaveLength(4);
      expect(complexContext.routes[0]?.path).toContain(':id');
      expect(complexContext.routes[2]?.path).toContain('*');
      expect(complexContext.routes[3]?.methods).toHaveLength(4);
    });
  });

  describe('Type Compatibility and Object Assignment', () => {
    it('should allow assignment between compatible IRouteInfo objects', () => {
      const source: IRouteInfo = {
        path: '/source',
        methods: ['GET'],
        auth: 'token'
      };

      const target: IRouteInfo = source;

      expect(target.path).toBe('/source');
      expect(target.methods).toEqual(['GET']);
      expect(target.auth).toBe('token');
    });

    it('should allow spreading IRouteInfo objects', () => {
      const baseRoute: IRouteInfo = {
        path: '/base',
        methods: ['GET'],
        auth: 'basic'
      };

      const extendedRoute: IRouteInfo = {
        ...baseRoute,
        methods: ['GET', 'POST'],
        auth: 'bearer'
      };

      expect(extendedRoute.path).toBe('/base');
      expect(extendedRoute.methods).toEqual(['GET', 'POST']);
      expect(extendedRoute.auth).toBe('bearer');
    });

    it('should allow partial object creation for IExpressLayer', () => {
      const minimalLayer: IExpressLayer = {
        name: 'minimal',
        handle: {},
        regexp: { source: '^/minimal$' }
      };

      const extendedLayer: IExpressLayer = {
        ...minimalLayer,
        route: {
          path: '/extended',
          methods: { GET: true }
        }
      };

      expect(extendedLayer.name).toBe('minimal');
      expect(extendedLayer.route?.path).toBe('/extended');
    });

    it('should allow array operations on IRouteContext routes', () => {
      const context: IRouteContext = {
        routes: [
          { path: '/route1', methods: ['GET'], auth: 'none' },
          { path: '/route2', methods: ['POST'], auth: 'jwt' }
        ],
        prefix: '/api',
        authType: 'mixed'
      };

      const filteredRoutes = context.routes.filter(route => route.auth === 'jwt');
      const mappedPaths = context.routes.map(route => route.path);

      expect(filteredRoutes).toHaveLength(1);
      expect(filteredRoutes[0]?.path).toBe('/route2');
      expect(mappedPaths).toEqual(['/route1', '/route2']);
    });

    it('should allow deep property access on nested structures', () => {
      const app: IExpressAppWithRouter = {
        _router: {
          stack: [
            {
              name: 'nestedRouter',
              handle: {
                stack: [
                  {
                    route: {
                      path: '/deep',
                      methods: { GET: true, POST: false }
                    },
                    name: 'deepRoute',
                    handle: {},
                    regexp: { source: '^/deep$' }
                  }
                ]
              },
              regexp: { source: '^/nested' }
            }
          ]
        }
      };

      const deepRoute = app._router?.stack[0]?.handle.stack?.[0];
      expect(deepRoute?.route?.path).toBe('/deep');
      expect(deepRoute?.route?.methods.GET).toBe(true);
      expect(deepRoute?.route?.methods.POST).toBe(false);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle undefined and optional properties correctly', () => {
      const layerWithUndefinedRoute: IExpressLayer = {
        name: 'undefinedRoute',
        handle: {},
        regexp: { source: '^/test$' }
      };

      expect(layerWithUndefinedRoute.route).toBeUndefined();
      expect(layerWithUndefinedRoute.handle.stack).toBeUndefined();
    });

    it('should handle empty string values', () => {
      const emptyStringRoute: IRouteInfo = {
        path: '',
        methods: [],
        auth: ''
      };

      expect(emptyStringRoute.path).toBe('');
      expect(emptyStringRoute.auth).toBe('');
      expect(emptyStringRoute.methods).toHaveLength(0);
    });

    it('should handle special characters in paths and names', () => {
      const specialCharsRoute: IRouteInfo = {
        path: '/api/special-chars_$@#%^&*()',
        methods: ['GET'],
        auth: 'special_auth_type'
      };

      const specialCharsLayer: IExpressLayer = {
        name: 'special-layer_$@#%^&*()',
        handle: {},
        regexp: { source: '^/special.*$' }
      };

      expect(specialCharsRoute.path).toBe('/api/special-chars_$@#%^&*()');
      expect(specialCharsRoute.auth).toBe('special_auth_type');
      expect(specialCharsLayer.name).toBe('special-layer_$@#%^&*()');
    });

    it('should handle very long paths and complex regex patterns', () => {
      const longPath = '/api/v1/very/long/path/with/many/segments/and/parameters/:id/nested/:subId/deeply/:deepId';
      const complexRegex = '^\/api\/v[0-9]+\/very\/long\/path\/with\/many\/segments\/and\/parameters\/([^\/]+)\/nested\/([^\/]+)\/deeply\/([^\/]+)\/?$';

      const complexRoute: IRouteInfo = {
        path: longPath,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        auth: 'complex_auth_with_long_name'
      };

      const complexLayer: IExpressLayer = {
        name: 'complexRouteHandler',
        handle: {},
        regexp: { source: complexRegex }
      };

      expect(complexRoute.path).toBe(longPath);
      expect(complexRoute.methods).toHaveLength(7);
      expect(complexLayer.regexp.source).toBe(complexRegex);
    });

    it('should handle numeric and boolean values in method records', () => {
      const mixedMethodsLayer: IExpressLayer = {
        route: {
          path: '/mixed',
          methods: {
            GET: true,
            POST: false,
            PUT: true,
            DELETE: false,
            PATCH: true,
            HEAD: false,
            OPTIONS: true
          }
        },
        name: 'mixedMethods',
        handle: {},
        regexp: { source: '^/mixed$' }
      };

      const methods = mixedMethodsLayer.route?.methods;
      expect(typeof methods?.GET).toBe('boolean');
      expect(typeof methods?.POST).toBe('boolean');
      expect(methods?.GET).toBe(true);
      expect(methods?.POST).toBe(false);
    });
  });

  describe('Object Creation and Validation Utilities', () => {
    it('should validate route info object structure', () => {
      const isValidRouteInfo = (obj: any): obj is IRouteInfo => {
        return (
          obj &&
          typeof obj.path === 'string' &&
          Array.isArray(obj.methods) &&
          typeof obj.auth === 'string'
        );
      };

      const validRoute = { path: '/test', methods: ['GET'], auth: 'bearer' };
      const invalidRoute1 = { path: 123, methods: ['GET'], auth: 'bearer' };
      const invalidRoute2 = { path: '/test', methods: 'GET', auth: 'bearer' };
      const invalidRoute3 = { path: '/test', methods: ['GET'], auth: 123 };

      expect(isValidRouteInfo(validRoute)).toBe(true);
      expect(isValidRouteInfo(invalidRoute1)).toBe(false);
      expect(isValidRouteInfo(invalidRoute2)).toBe(false);
      expect(isValidRouteInfo(invalidRoute3)).toBe(false);
    });

    it('should validate express layer object structure', () => {
      const isValidExpressLayer = (obj: any): obj is IExpressLayer => {
        return Boolean(
          obj &&
          typeof obj === 'object' &&
          typeof obj.name === 'string' &&
          obj.handle &&
          typeof obj.handle === 'object' &&
          obj.handle !== null &&
          obj.regexp &&
          typeof obj.regexp === 'object' &&
          typeof obj.regexp.source === 'string'
        );
      };

      const validLayer = {
        name: 'test',
        handle: {},
        regexp: { source: '^/test$' }
      };
      const invalidLayer1 = {
        name: 123,
        handle: {},
        regexp: { source: '^/test$' }
      };
      const invalidLayer2 = {
        name: 'test',
        handle: null,
        regexp: { source: '^/test$' }
      };

      expect(isValidExpressLayer(validLayer)).toBe(true);
      expect(isValidExpressLayer(invalidLayer1)).toBe(false);
      expect(isValidExpressLayer(invalidLayer2)).toBe(false);
    });

    it('should create route info factory function', () => {
      const createRouteInfo = (
        path: string,
        methods: string[],
        auth: string
      ): IRouteInfo => ({
        path,
        methods,
        auth
      });

      const route1 = createRouteInfo('/api/users', ['GET', 'POST'], 'jwt');
      const route2 = createRouteInfo('/health', ['GET'], 'none');

      expect(route1.path).toBe('/api/users');
      expect(route1.methods).toEqual(['GET', 'POST']);
      expect(route1.auth).toBe('jwt');

      expect(route2.path).toBe('/health');
      expect(route2.methods).toEqual(['GET']);
      expect(route2.auth).toBe('none');
    });

    it('should create route context factory function', () => {
      const createRouteContext = (
        routes: IRouteInfo[],
        prefix: string,
        authType: string
      ): IRouteContext => ({
        routes,
        prefix,
        authType
      });

      const routes: IRouteInfo[] = [
        { path: '/users', methods: ['GET'], auth: 'jwt' },
        { path: '/posts', methods: ['GET', 'POST'], auth: 'bearer' }
      ];

      const context = createRouteContext(routes, '/api/v1', 'mixed');

      expect(context.routes).toHaveLength(2);
      expect(context.prefix).toBe('/api/v1');
      expect(context.authType).toBe('mixed');
      expect(context.routes[0]?.path).toBe('/users');
      expect(context.routes[1]?.methods).toEqual(['GET', 'POST']);
    });
  });
});