/**
 * @fileoverview Performance benchmarks for critical paths
 * @module tests/performance/critical-paths.bench
 * 
 * Measures performance of critical operations to ensure they meet
 * performance requirements and detect regressions.
 */

import { bench, describe } from 'vitest';
import { 
  isValidTaskId, 
  isValidSessionId, 
  isValidRequestId 
} from '../../src/utils/id-validation';
import { rateLimitMiddleware } from '../../src/server/middleware';
import { 
  ExpressMockBuilder, 
  MockDataGenerator,
  OAuthTestBuilder 
} from '../utils/test-builders';

describe('ID Validation Performance', () => {
  const validTaskId = 'task_20231225_235959_000001';
  const validSessionId = 'session_1234567890123_abc123def';
  const validRequestId = 'req_550e8400-e29b-41d4-a716-446655440000';
  const invalidId = 'this-is-not-a-valid-id-format';

  bench('isValidTaskId - valid ID', () => {
    isValidTaskId(validTaskId);
  });

  bench('isValidTaskId - invalid ID', () => {
    isValidTaskId(invalidId);
  });

  bench('isValidSessionId - valid ID', () => {
    isValidSessionId(validSessionId);
  });

  bench('isValidSessionId - invalid ID', () => {
    isValidSessionId(invalidId);
  });

  bench('isValidRequestId - valid ID', () => {
    isValidRequestId(validRequestId);
  });

  bench('isValidRequestId - invalid ID', () => {
    isValidRequestId(invalidId);
  });

  bench('ID validation - mixed workload', () => {
    isValidTaskId(validTaskId);
    isValidSessionId(validSessionId);
    isValidRequestId(validRequestId);
    isValidTaskId(invalidId);
    isValidSessionId(invalidId);
    isValidRequestId(invalidId);
  });
});

describe('Rate Limiting Performance', () => {
  const middleware = rateLimitMiddleware(60000, 100);
  const req = ExpressMockBuilder.createRequest();
  const res = ExpressMockBuilder.createResponse();
  const next = ExpressMockBuilder.createNext();

  bench('Rate limit check - single IP', () => {
    middleware(req as any, res as any, next);
  });

  bench('Rate limit check - different IPs', () => {
    const ips = MockDataGenerator.generateIPs(10);
    ips.forEach(ip => {
      const request = ExpressMockBuilder.createRequest({ ip });
      middleware(request as any, res as any, next);
    });
  });

  bench('Rate limit check - with headers', () => {
    const request = ExpressMockBuilder.createRequest({
      headers: {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        'x-real-ip': '192.168.1.1'
      }
    });
    middleware(request as any, res as any, next);
  });
});

describe('OAuth Flow Performance', () => {
  bench('Authorization URL generation', () => {
    const params = OAuthTestBuilder.createAuthorizationRequest();
    const url = new URL('https://auth.example.com/authorize');
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value as string);
    });
    
    url.toString();
  });

  bench('Token validation', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    
    // Parse token
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = Buffer.from(parts[1], 'base64url').toString();
      JSON.parse(payload);
    }
  });

  bench('PKCE challenge generation', () => {
    const crypto = require('crypto');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  });
});

describe('Session Management Performance', () => {
  const sessions = new Map<string, any>();
  const sessionData = {
    userId: 'user-123',
    createdAt: Date.now(),
    lastActivity: Date.now(),
    metadata: { ip: '192.168.1.1', userAgent: 'test' }
  };

  // Pre-populate with some sessions
  for (let i = 0; i < 1000; i++) {
    sessions.set(`session_${i}`, { ...sessionData });
  }

  bench('Session creation', () => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    sessions.set(sessionId, { ...sessionData });
  });

  bench('Session lookup', () => {
    sessions.get('session_500');
  });

  bench('Session update', () => {
    const session = sessions.get('session_500');
    if (session) {
      session.lastActivity = Date.now();
    }
  });

  bench('Session cleanup (old sessions)', () => {
    const now = Date.now();
    const timeout = 3600000; // 1 hour
    
    for (const [id, session] of sessions.entries()) {
      if (now - session.lastActivity > timeout) {
        sessions.delete(id);
      }
    }
  });
});

describe('JSON Processing Performance', () => {
  const smallPayload = { id: 'test', value: 123, active: true };
  const mediumPayload = OAuthTestBuilder.createTokenResponse();
  const largePayload = {
    users: Array(100).fill(null).map((_, i) => ({
      id: `user-${i}`,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      roles: ['user', 'member'],
      metadata: {
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        preferences: { theme: 'dark', language: 'en' }
      }
    }))
  };

  bench('JSON stringify - small payload', () => {
    JSON.stringify(smallPayload);
  });

  bench('JSON stringify - medium payload', () => {
    JSON.stringify(mediumPayload);
  });

  bench('JSON stringify - large payload', () => {
    JSON.stringify(largePayload);
  });

  bench('JSON parse - small payload', () => {
    JSON.parse('{"id":"test","value":123,"active":true}');
  });

  bench('JSON parse - medium payload', () => {
    JSON.parse('{"access_token":"mock-token","token_type":"Bearer","expires_in":3600}');
  });
});

describe('String Operations Performance', () => {
  const shortString = 'test-string';
  const mediumString = 'a'.repeat(100);
  const longString = 'a'.repeat(1000);
  const regex = /^[a-zA-Z0-9-_]+$/;

  bench('Regex test - short string', () => {
    regex.test(shortString);
  });

  bench('Regex test - medium string', () => {
    regex.test(mediumString);
  });

  bench('Regex test - long string', () => {
    regex.test(longString);
  });

  bench('String split - by delimiter', () => {
    'user.module.service.action'.split('.');
  });

  bench('String replace - single occurrence', () => {
    'hello-world'.replace('-', '_');
  });

  bench('String replace - global', () => {
    'hello-world-test-string'.replace(/-/g, '_');
  });
});

describe('Map vs Object Performance', () => {
  const map = new Map<string, any>();
  const obj: Record<string, any> = {};
  
  // Pre-populate
  for (let i = 0; i < 1000; i++) {
    const key = `key-${i}`;
    const value = { id: i, data: `value-${i}` };
    map.set(key, value);
    obj[key] = value;
  }

  bench('Map - set operation', () => {
    map.set('new-key', { id: 1001, data: 'new-value' });
  });

  bench('Object - set operation', () => {
    obj['new-key'] = { id: 1001, data: 'new-value' };
  });

  bench('Map - get operation', () => {
    map.get('key-500');
  });

  bench('Object - get operation', () => {
    obj['key-500'];
  });

  bench('Map - has operation', () => {
    map.has('key-500');
  });

  bench('Object - hasOwnProperty', () => {
    obj.hasOwnProperty('key-500');
  });

  bench('Map - delete operation', () => {
    map.delete('key-999');
  });

  bench('Object - delete operation', () => {
    delete obj['key-999'];
  });

  bench('Map - iterate all entries', () => {
    let count = 0;
    for (const [key, value] of map) {
      count++;
    }
  });

  bench('Object - iterate all entries', () => {
    let count = 0;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        count++;
      }
    }
  });
});

describe('Critical Path Scenarios', () => {
  bench('Complete OAuth authorization flow', () => {
    // 1. Generate state and nonce
    const state = `state_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const nonce = `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // 2. Build authorization URL
    const authParams = OAuthTestBuilder.createAuthorizationRequest({ state, nonce });
    const authUrl = new URL('https://auth.example.com/authorize');
    Object.entries(authParams).forEach(([k, v]) => authUrl.searchParams.set(k, v as string));
    
    // 3. Generate authorization code
    const code = `code_${Date.now()}_${Math.random().toString(36).substring(2, 20)}`;
    
    // 4. Store code with metadata
    const codeData = {
      clientId: authParams.client_id,
      redirectUri: authParams.redirect_uri,
      scope: authParams.scope,
      state,
      nonce,
      expiresAt: Date.now() + 600000
    };
    
    // 5. Validate code exchange
    const isValid = codeData.expiresAt > Date.now() && 
                   codeData.clientId === 'test-client';
    
    return { state, code, isValid };
  });

  bench('Session validation and refresh', () => {
    const sessionId = 'session_1234567890123_abc123def';
    
    // 1. Validate session ID format
    const isValid = isValidSessionId(sessionId);
    
    // 2. Look up session (simulated)
    const session = {
      userId: 'user-123',
      createdAt: Date.now() - 1800000, // 30 minutes ago
      lastActivity: Date.now() - 300000, // 5 minutes ago
      expiresAt: Date.now() + 3300000 // 55 minutes from now
    };
    
    // 3. Check if expired
    const isExpired = session.expiresAt < Date.now();
    
    // 4. Update last activity if valid
    if (!isExpired) {
      session.lastActivity = Date.now();
    }
    
    return { isValid, isExpired };
  });

  bench('Rate limit check with cleanup', () => {
    const rateLimits = new Map<string, { count: number; resetAt: number }>();
    const ip = '192.168.1.100';
    const now = Date.now();
    const window = 60000;
    const limit = 100;
    
    // 1. Get or create rate limit entry
    let rateLimit = rateLimits.get(ip);
    if (!rateLimit || rateLimit.resetAt < now) {
      rateLimit = { count: 0, resetAt: now + window };
      rateLimits.set(ip, rateLimit);
    }
    
    // 2. Check if limit exceeded
    const allowed = rateLimit.count < limit;
    if (allowed) {
      rateLimit.count++;
    }
    
    // 3. Clean up old entries (every 100th request)
    if (Math.random() < 0.01) {
      for (const [key, value] of rateLimits.entries()) {
        if (value.resetAt < now) {
          rateLimits.delete(key);
        }
      }
    }
    
    return { allowed, remaining: limit - rateLimit.count };
  });
});

// Performance baseline expectations
describe('Performance Baselines', () => {
  bench('Baseline: empty function', () => {
    // This establishes the overhead of the benchmarking itself
  });

  bench('Baseline: simple math operation', () => {
    Math.sqrt(16) + Math.pow(2, 8);
  });

  bench('Baseline: array creation', () => {
    Array(100).fill(0);
  });

  bench('Baseline: object creation', () => {
    ({ id: 1, name: 'test', active: true });
  });

  bench('Baseline: Date.now()', () => {
    Date.now();
  });

  bench('Baseline: crypto.randomBytes', () => {
    require('crypto').randomBytes(16);
  });
});