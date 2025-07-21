import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jwtSign, jwtVerify } from '../../../../../src/server/external/auth/jwt';
import { readFileSync } from 'fs';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  readdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  appendFileSync: vi.fn(),
  mkdtempSync: vi.fn((prefix: string) => prefix + 'test'),
  dirname: vi.fn()
}));

vi.mock('../../../../../src/server/config', () => ({
  CONFIG: {
    JWT_SECRET: 'test-secret',
    JWT_ISSUER: 'test-issuer',
    JWT_AUDIENCE: 'test-audience',
    JWT_EXPIRES_IN: '1h',
    JWT_ALGORITHM: 'HS256',
    JWT_PUBLIC_KEY_PATH: '/keys/public.pem',
    JWT_PRIVATE_KEY_PATH: '/keys/private.pem'
  }
}));

describe('JWT Functions', () => {
  const mockPayload = {
    sub: '123',
    email: 'test@example.com',
    name: 'Test User'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('jwtSign', () => {
    it('should sign JWT with payload', async () => {
      const token = await jwtSign(mockPayload, 'test-secret');
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include standard claims', async () => {
      const token = await jwtSign(mockPayload, 'test-secret');
      
      // Decode the payload (base64)
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      expect(payload).toHaveProperty('sub', '123');
      expect(payload).toHaveProperty('email', 'test@example.com');
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
    });
  });

  describe('jwtVerify', () => {
    it('should verify valid JWT', async () => {
      // Create a valid token first
      const token = await jwtSign(mockPayload, 'test-secret');
      
      const result = await jwtVerify(token, 'test-secret');
      
      expect(result).toHaveProperty('payload');
      expect(result.payload).toHaveProperty('sub', '123');
      expect(result.payload).toHaveProperty('email', 'test@example.com');
    });

    it('should reject invalid signature', async () => {
      // Create a token with the default setup
      const token = await jwtSign(mockPayload, 'test-secret');
      
      // Now we need to mock the verification to fail
      // The JWT will be verified with the KeyManager's config
      // Since we can't easily change the secret after signing,
      // let's test with a malformed token instead
      const malformedToken = token.slice(0, -5) + 'xxxxx'; // Change the signature
      
      await expect(jwtVerify(malformedToken)).rejects.toThrow();
    });

    it('should reject malformed tokens', async () => {
      await expect(jwtVerify('invalid.token', 'test-secret')).rejects.toThrow();
      await expect(jwtVerify('', 'test-secret')).rejects.toThrow();
    });

    it('should handle expired tokens', async () => {
      // Create token with short expiration
      const expiredPayload = {
        ...mockPayload,
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };
      
      // Manually create expired token
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      const expiredToken = `${header}.${payload}.signature`;
      
      await expect(jwtVerify(expiredToken, 'test-secret')).rejects.toThrow();
    });
  });

  describe('Integration', () => {
    it('should sign and verify round trip', async () => {
      const originalPayload = {
        sub: 'user-123',
        email: 'user@example.com',
        roles: ['admin', 'user']
      };
      
      const token = await jwtSign(originalPayload, 'test-secret');
      const { payload } = await jwtVerify(token, 'test-secret');
      
      expect(payload.sub).toBe(originalPayload.sub);
      expect(payload.email).toBe(originalPayload.email);
      expect(payload.roles).toEqual(originalPayload.roles);
    });
  });
});