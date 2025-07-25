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
  LoggerService: {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
    })),
  },
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
  createAuthMiddleware: vi.fn(() => vi.fn()),
  authMiddleware: vi.fn(),
}));

vi.mock('@/server/external/constants/http.constants.js', () => ({
  HTTP_STATUS: {
    INTERNAL_SERVER_ERROR: 500,
  },
}));

vi.mock('@/server/external/rest/callback.js', () => ({
  setupRoutes: vi.fn(),
}));

vi.mock('@/server/external/rest/api/users.js', () => ({
  setupRoutes: vi.fn(),
}));

vi.mock('@/server/external/rest/dashboard.js', () => ({
  setupRoutes: vi.fn(),
}));

vi.mock('@/server/external/rest/api/terminal.js', () => ({
  setupRoutes: vi.fn(),
}));

vi.mock('@/server/external/types/routes.types.js', () => ({}));

vi.mock('@/server/external/routes.js', () => ({
  configureRoutes: vi.fn(),
}));

describe('External API Setup', () => {
  let mockApp: Express;

  beforeEach(() => {
    mockApp = {
      use: vi.fn(),
    } as any;

    vi.clearAllMocks();
  });

  it('should set up all external endpoints', async () => {
    const { setupExternalEndpoints } = await import('@/server/external/index.js');
    const cookieParser = (await import('cookie-parser')).default;

    await setupExternalEndpoints(mockApp);

    expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // cookieParser
    expect(cookieParser).toHaveBeenCalled();
  });

  it('should configure routes through configureRoutes', async () => {
    const { setupExternalEndpoints } = await import('@/server/external/index.js');
    
    // Mock the configureRoutes import
    const mockConfigureRoutes = vi.fn();
    vi.doMock('@/server/external/routes.js', () => ({
      configureRoutes: mockConfigureRoutes,
    }));

    await setupExternalEndpoints(mockApp);

    expect(mockConfigureRoutes).toHaveBeenCalledWith(mockApp);
  });

  it('should use cookie parser middleware', async () => {
    const { setupExternalEndpoints } = await import('@/server/external/index.js');
    const cookieParser = (await import('cookie-parser')).default;

    await setupExternalEndpoints(mockApp);

    expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
    expect(cookieParser).toHaveBeenCalled();
  });

  it('should log debug information in non-production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const { setupExternalEndpoints } = await import('@/server/external/index.js');
    const { LoggerService } = await import('@/modules/core/logger/index.js');
    const mockLoggerInstance = vi.mocked(LoggerService.getInstance());

    await setupExternalEndpoints(mockApp);

    expect(mockLoggerInstance.debug).toHaveBeenCalledWith('SERVER', 'External endpoints configured', {
      category: 'routes',
      persistToDb: false,
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should not log debug information in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const { setupExternalEndpoints } = await import('@/server/external/index.js');
    const { LoggerService } = await import('@/modules/core/logger/index.js');
    const mockLoggerInstance = vi.mocked(LoggerService.getInstance());

    await setupExternalEndpoints(mockApp);

    expect(mockLoggerInstance.debug).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });
});
