/**
 * @fileoverview Test builders and factories for reducing test duplication
 * @module tests/utils/test-builders
 * 
 * Provides builder patterns and factory functions to create test data
 * and reduce boilerplate in test files.
 */

import { vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Express mock builders
 */
export class ExpressMockBuilder {
  static createRequest(overrides: Partial<Request> = {}): Partial<Request> {
    return {
      body: {},
      headers: {},
      params: {},
      query: {},
      ip: '127.0.0.1',
      method: 'GET',
      originalUrl: '/',
      path: '/',
      protocol: 'http',
      get: vi.fn((header: string) => overrides.headers?.[header.toLowerCase()]),
      ...overrides
    };
  }

  static createResponse(overrides: Partial<Response> = {}): Partial<Response> {
    const res: Partial<Response> = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      write: vi.fn().mockReturnThis(),
      locals: {},
      headersSent: false,
      ...overrides
    };
    
    // Make chainable methods return the response object
    ['status', 'json', 'send', 'setHeader', 'header', 'redirect', 'end', 'write'].forEach(method => {
      if (res[method] && vi.isMockFunction(res[method])) {
        res[method].mockReturnValue(res);
      }
    });
    
    return res;
  }

  static createNext(): NextFunction {
    return vi.fn();
  }
}

/**
 * OAuth test data builders
 */
export class OAuthTestBuilder {
  static createAuthorizationRequest(overrides: any = {}) {
    return {
      response_type: 'code',
      client_id: 'test-client',
      redirect_uri: 'http://localhost:3000/callback',
      scope: 'read write',
      state: 'test-state',
      ...overrides
    };
  }

  static createTokenRequest(overrides: any = {}) {
    return {
      grant_type: 'authorization_code',
      code: 'test-auth-code',
      client_id: 'test-client',
      client_secret: 'test-secret',
      redirect_uri: 'http://localhost:3000/callback',
      ...overrides
    };
  }

  static createTokenResponse(overrides: any = {}) {
    return {
      access_token: 'mock-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
      scope: 'read write',
      ...overrides
    };
  }

  static createUserInfo(overrides: any = {}) {
    return {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      email_verified: true,
      picture: 'https://example.com/avatar.jpg',
      ...overrides
    };
  }

  static createProviderConfig(overrides: any = {}) {
    return {
      id: 'test-provider',
      name: 'Test Provider',
      type: 'oauth2',
      clientid: 'test-client-id',
      clientsecret: 'test-client-secret',
      redirecturi: 'http://localhost:3000/callback',
      scope: 'read write',
      ...overrides
    };
  }
}

/**
 * MCP test builders
 */
export class MCPTestBuilder {
  static createMockServer(overrides: Partial<Server> = {}): any {
    return {
      setRequestHandler: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
      ...overrides
    };
  }

  static createMockTransport(overrides: any = {}): any {
    return {
      handleRequest: vi.fn().mockImplementation(async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] || 
                        req.headers['x-session-id'] || 
                        `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        
        res.setHeader('mcp-session-id', sessionId);
        res.setHeader('x-session-id', sessionId);
      }),
      close: vi.fn(),
      ...overrides
    };
  }

  static createMCPRequest(overrides: any = {}) {
    return {
      jsonrpc: '2.0',
      method: 'test-method',
      params: {},
      id: 1,
      ...overrides
    };
  }

  static createMCPError(code: number, message: string, data?: any) {
    return {
      jsonrpc: '2.0',
      error: {
        code,
        message,
        ...(data && { data })
      },
      id: null
    };
  }
}

/**
 * Task and Session builders
 */
export class TaskTestBuilder {
  static createTask(overrides: any = {}) {
    const now = new Date().toISOString();
    return {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type: 'test-task',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      metadata: {},
      ...overrides
    };
  }

  static createSession(overrides: any = {}) {
    return {
      id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata: {},
      ...overrides
    };
  }

  static createTaskUpdate(overrides: any = {}) {
    return {
      status: 'in_progress',
      progress: 50,
      message: 'Processing...',
      ...overrides
    };
  }
}

/**
 * Module and Registry builders
 */
export class ModuleTestBuilder {
  static createModule(overrides: any = {}) {
    return {
      name: 'test-module',
      version: '1.0.0',
      type: 'service',
      initialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
      ...overrides
    };
  }

  static createCLICommand(overrides: any = {}) {
    return {
      name: 'test:command',
      description: 'Test command',
      args: [],
      options: [],
      execute: vi.fn().mockResolvedValue(undefined),
      ...overrides
    };
  }

  static createConfig(overrides: any = {}) {
    return {
      get: vi.fn(),
      set: vi.fn(),
      has: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      ...overrides
    };
  }

  static createLogger(overrides: any = {}) {
    return {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      ...overrides
    };
  }
}

/**
 * Test scenario builders for complex flows
 */
export class TestScenarioBuilder {
  static createOAuthFlow() {
    const state = 'test-state-' + Date.now();
    const code = 'test-code-' + Date.now();
    const nonce = 'test-nonce-' + Date.now();
    
    return {
      authRequest: OAuthTestBuilder.createAuthorizationRequest({ state, nonce }),
      authCode: code,
      tokenRequest: OAuthTestBuilder.createTokenRequest({ code }),
      tokenResponse: OAuthTestBuilder.createTokenResponse(),
      userInfo: OAuthTestBuilder.createUserInfo()
    };
  }

  static createPKCEFlow() {
    const flow = TestScenarioBuilder.createOAuthFlow();
    const codeVerifier = 'test-verifier-' + Date.now() + '-long-enough-string';
    const codeChallenge = require('crypto')
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    return {
      ...flow,
      codeVerifier,
      codeChallenge,
      authRequest: {
        ...flow.authRequest,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      },
      tokenRequest: {
        ...flow.tokenRequest,
        code_verifier: codeVerifier
      }
    };
  }

  static createRateLimitScenario(options: { window?: number; limit?: number; ips?: string[] } = {}) {
    const { 
      window = 60000, 
      limit = 10, 
      ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3'] 
    } = options;
    
    return {
      window,
      limit,
      ips,
      requests: ips.map(ip => ExpressMockBuilder.createRequest({ ip })),
      responses: ips.map(() => ExpressMockBuilder.createResponse()),
      nexts: ips.map(() => ExpressMockBuilder.createNext())
    };
  }
}

/**
 * Assertion helpers
 */
export class TestAssertions {
  static assertOAuthError(res: any, error: string, description?: string) {
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error,
      ...(description && { error_description: description })
    });
  }

  static assertJSONRPCError(res: any, code: number, message: string) {
    expect(res.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      error: {
        code,
        message,
        data: expect.any(Object)
      },
      id: null
    });
  }

  static assertRateLimited(res: any) {
    expect(res.status).toHaveBeenCalledWith(429);
    TestAssertions.assertJSONRPCError(res, -32000, 'Too many requests');
  }

  static assertTokenResponse(response: any, options: any = {}) {
    const expectations: any = {
      access_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: expect.any(Number)
    };

    if (options.includeRefresh) {
      expectations.refresh_token = expect.any(String);
    }

    if (options.includeIdToken) {
      expectations.id_token = expect.any(String);
    }

    if (options.scope) {
      expectations.scope = options.scope;
    }

    expect(response).toMatchObject(expectations);
  }
}

/**
 * Performance test utilities
 */
export class PerformanceTestUtils {
  static async measureExecutionTime(fn: () => void | Promise<void>, iterations: number = 1000): Promise<number> {
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await fn();
    }
    
    const duration = performance.now() - start;
    return duration / iterations;
  }

  static createLoadTest(options: {
    concurrency: number;
    duration: number;
    requestFn: () => Promise<void>;
  }) {
    const { concurrency, duration, requestFn } = options;
    const startTime = Date.now();
    const results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };

    const runWorker = async () => {
      while (Date.now() - startTime < duration) {
        const requestStart = performance.now();
        try {
          await requestFn();
          results.successfulRequests++;
        } catch {
          results.failedRequests++;
        }
        results.totalRequests++;
        
        const requestDuration = performance.now() - requestStart;
        results.averageResponseTime = 
          (results.averageResponseTime * (results.totalRequests - 1) + requestDuration) / 
          results.totalRequests;
      }
    };

    return {
      run: async () => {
        await Promise.all(Array(concurrency).fill(null).map(() => runWorker()));
        return results;
      }
    };
  }
}

/**
 * Mock data generators
 */
export class MockDataGenerator {
  static generateIPs(count: number): string[] {
    return Array(count).fill(null).map((_, i) => 
      `192.168.${Math.floor(i / 256)}.${i % 256}`
    );
  }

  static generateSessionIds(count: number): string[] {
    return Array(count).fill(null).map(() => 
      `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    );
  }

  static generateTaskIds(count: number): string[] {
    return Array(count).fill(null).map((_, i) => {
      const date = new Date();
      date.setSeconds(date.getSeconds() + i);
      const dateStr = date.toISOString().replace(/[-:T]/g, '').slice(0, 14);
      return `task_${dateStr}_${i.toString().padStart(6, '0')}`;
    });
  }

  static generateOAuthCodes(count: number): string[] {
    return Array(count).fill(null).map(() => 
      `code_${Date.now()}_${Math.random().toString(36).substring(2, 20)}`
    );
  }
}