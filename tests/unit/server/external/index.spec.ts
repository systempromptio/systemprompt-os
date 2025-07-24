/**
 * @fileoverview Unit tests for external REST API configuration
 * @module tests/unit/server/external
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Express } from 'express';
import { setupExternalEndpoints } from '@/server/external/index.js';
import { CONFIG } from '@/server/config.js';

vi.mock('@/server/config.js', () => ({
  CONFIG: {
    BASEURL: 'https://test.example.com',
  },
}));

vi.mock('@/modules/core/logger/index.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('cookie-parser', () => ({
  default: vi.fn(() => vi.fn()),
}));

vi.mock('express', () => ({
  Router: vi.fn(() => ({
    get: vi.fn(),
    post: vi.fn(),
    use: vi.fn(),
    stack: [],
  })),
}));

vi.mock('@/server/external/rest/oauth2/index.js', () => ({
  setupOAuth2Routes: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/external/rest/health.js', () => ({
  HealthEndpoint: vi.fn().mockImplementation(() => ({
    getHealth: vi.fn(),
  })),
}));

vi.mock('@/server/external/rest/splash.js', () => ({
  setupRoutes: vi.fn(),
}));

vi.mock('@/server/external/rest/auth.js', () => ({
  setupRoutes: vi.fn(),
}));

vi.mock('@/server/external/rest/config.js', () => ({
  setupRoutes: vi.fn(),
  setupPublicRoutes: vi.fn(),
}));

vi.mock('@/server/external/middleware/auth.js', () => ({
  authMiddleware: vi.fn(),
}));

describe('External API Setup', () => {
  let mockApp: Express;
  let mockRouter: any;

  beforeEach(() => {
    mockApp = {
      use: vi.fn(),
    } as any;

    mockRouter = {
      get: vi.fn(),
      post: vi.fn(),
      use: vi.fn(),
      stack: [],
    };

    vi.clearAllMocks();
  });

  it('should set up all external endpoints', async () => {
    const { setupExternalEndpoints } = await import('@/server/external/index.js');
    const { setupOAuth2Routes } = await import('@/server/external/rest/oauth2/index.js');
    const { HealthEndpoint } = await import('@/server/external/rest/health.js');
    const { setupRoutes: setupSplashRoutes } = await import('@/server/external/rest/splash.js');
    const { setupRoutes: setupAuthRoutes } = await import('@/server/external/rest/auth.js');
    const { setupRoutes: setupConfigRoutes, setupPublicRoutes } = await import(
      '@/server/external/rest/config.js'
    );
    const cookieParser = (await import('cookie-parser')).default;

    await setupExternalEndpoints(mockApp, mockRouter);

    expect(mockApp.use).toHaveBeenCalledTimes(3); // cookieParser, router, protectedRouter
    expect(mockApp.use).toHaveBeenNthCalledWith(1, expect.any(Function)); // cookieParser
    expect(setupOAuth2Routes).toHaveBeenCalledWith(mockRouter, CONFIG.BASEURL);
    expect(HealthEndpoint).toHaveBeenCalled();
    expect(mockRouter.get).toHaveBeenCalledWith('/health', expect.any(Function));
    expect(setupSplashRoutes).toHaveBeenCalledWith(mockRouter);
    expect(setupAuthRoutes).toHaveBeenCalledWith(mockRouter);
    expect(setupPublicRoutes).toHaveBeenCalledWith(mockRouter);
    expect(mockApp.use).toHaveBeenCalledWith(mockRouter);
  });

  it('should set up protected routes with auth middleware', async () => {
    const { Router } = await import('express');
    const { authMiddleware } = await import('@/server/external/middleware/auth.js');
    const { setupRoutes: setupConfigRoutes } = await import('@/server/external/rest/config.js');

    const mockProtectedRouter = {
      use: vi.fn(),
    };

    vi.mocked(Router).mockReturnValueOnce(mockProtectedRouter as any);

    await setupExternalEndpoints(mockApp, mockRouter);

    expect(Router).toHaveBeenCalled();
    expect(mockProtectedRouter.use).toHaveBeenCalledWith(authMiddleware);
    expect(setupConfigRoutes).toHaveBeenCalledWith(mockProtectedRouter);
    expect(mockApp.use).toHaveBeenCalledWith(mockProtectedRouter);
  });

  it('should handle health endpoint requests', async () => {
    const mockReq = {};
    const mockRes = {};
    let healthHandler: Function;

    const mockHealthInstance = {
      getHealth: vi.fn(),
    };

    vi.mocked(await import('@/server/external/rest/health.js')).HealthEndpoint.mockImplementation(
      () => mockHealthInstance as any,
    );

    mockRouter.get = vi.fn((path, handler) => {
      if (path === '/health') {
        healthHandler = handler;
      }
    });

    await setupExternalEndpoints(mockApp, mockRouter);

    healthHandler!(mockReq, mockRes);

    expect(mockHealthInstance.getHealth).toHaveBeenCalledWith(mockReq, mockRes);
  });

  it('should log debug information in non-production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    mockRouter.stack = [
      { route: { path: '/test', methods: { get: true, post: true } } },
      { route: { path: '/auth', methods: { post: true } } },
      { notARoute: true },
    ];

    const { logger } = await import('@/modules/core/logger/index.js');

    await setupExternalEndpoints(mockApp, mockRouter);

    expect(logger.debug).toHaveBeenCalledWith('External endpoints configured', {
      routes: [
        { path: '/test', methods: ['get', 'post'] },
        { path: '/auth', methods: ['post'] },
      ],
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should not log debug information in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const { logger } = await import('@/modules/core/logger/index.js');

    await setupExternalEndpoints(mockApp, mockRouter);

    expect(logger.debug).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });
});
