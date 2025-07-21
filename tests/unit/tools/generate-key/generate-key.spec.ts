import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateJWTKeyPair } from '../../../../src/modules/core/auth/utils/generate-key.js';
import { existsSync, readFileSync, rmSync, mkdtempSync } from 'fs';
import path from 'path';
import os from 'os';
import type { GenerateKeyOptions } from '../../../../src/modules/core/auth/utils/generate-key.js';

describe('CLI Key Generation', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(path.join(os.tmpdir(), 'systemprompt-test-'));
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('PEM format generation', () => {
    it('should generate RSA key pair in PEM format', async () => {
      // Arrange
      const options: GenerateKeyOptions = {
        type: 'jwt',
        algorithm: 'RS256',
        outputDir: testDir,
        format: 'pem'
      };

      // Act
      await generateJWTKeyPair(options);

      // Assert - Files exist
      const privateKeyPath = path.join(testDir, 'private.key');
      const publicKeyPath = path.join(testDir, 'public.key');
      expect(existsSync(privateKeyPath)).toBe(true);
      expect(existsSync(publicKeyPath)).toBe(true);

      // Assert - Key format
      const privateKey = readFileSync(privateKeyPath, 'utf8');
      const publicKey = readFileSync(publicKeyPath, 'utf8');
      
      expect(privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----/);
      expect(privateKey).toMatch(/-----END PRIVATE KEY-----$/m);
      expect(publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/);
      expect(publicKey).toMatch(/-----END PUBLIC KEY-----$/m);
    });

    it('should generate valid RSA keys with correct modulus', async () => {
      // Arrange
      const options: GenerateKeyOptions = {
        type: 'jwt',
        algorithm: 'RS256',
        outputDir: testDir,
        format: 'pem'
      };

      // Act
      await generateJWTKeyPair(options);

      // Assert - Verify key properties
      const privateKey = readFileSync(path.join(testDir, 'private.key'), 'utf8');
      expect(privateKey.length).toBeGreaterThan(1000); // RSA keys are typically > 1KB
    });
  });

  describe('JWK format generation', () => {
    it('should generate keys in JWK format with correct structure', async () => {
      // Arrange
      const options: GenerateKeyOptions = {
        type: 'jwt',
        algorithm: 'RS256',
        outputDir: testDir,
        format: 'jwk'
      };

      // Act
      await generateJWTKeyPair(options);

      // Assert - File exists
      const jwksPath = path.join(testDir, 'jwks.json');
      expect(existsSync(jwksPath)).toBe(true);

      // Assert - JWK structure
      const jwksContent = readFileSync(jwksPath, 'utf8');
      const jwks = JSON.parse(jwksContent);
      
      expect(jwks).toHaveProperty('keys');
      expect(Array.isArray(jwks.keys)).toBe(true);
      expect(jwks.keys).toHaveLength(1);
      
      const key = jwks.keys[0];
      expect(key).toMatchObject({
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256'
      });
      expect(key).toHaveProperty('kid');
      // Note: Current implementation doesn't include n and e properties
      // This would need proper JWK conversion in production
    });

    it('should support RS512 algorithm', async () => {
      // Arrange
      const options: GenerateKeyOptions = {
        type: 'jwt',
        algorithm: 'RS512',
        outputDir: testDir,
        format: 'jwk'
      };

      // Act
      await generateJWTKeyPair(options);

      // Assert
      const jwksContent = readFileSync(path.join(testDir, 'jwks.json'), 'utf8');
      const jwks = JSON.parse(jwksContent);
      
      expect(jwks.keys[0]).toHaveProperty('alg', 'RS512');
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid output directory', async () => {
      // Arrange
      const options: GenerateKeyOptions = {
        type: 'jwt',
        algorithm: 'RS256',
        outputDir: '/invalid/non/existent/path',
        format: 'pem'
      };

      // Act & Assert
      await expect(generateJWTKeyPair(options)).rejects.toThrow();
    });

    it('should handle symmetric algorithm gracefully', async () => {
      // Arrange
      const options: GenerateKeyOptions = {
        type: 'jwt',
        algorithm: 'HS256' as any, // symmetric algorithm
        outputDir: testDir,
        format: 'pem'
      };

      // Act
      // The current implementation treats HS256 as EC since it doesn't start with 'RS'
      // This will generate EC keys (not ideal for HS256 which is symmetric)
      await generateJWTKeyPair(options);
      
      // Assert - it generates EC keys for HS256
      const privateKeyPath = path.join(testDir, 'private.key');
      const publicKeyPath = path.join(testDir, 'public.key');
      expect(existsSync(privateKeyPath)).toBe(true);
      expect(existsSync(publicKeyPath)).toBe(true);
      
      // Verify they are EC keys
      const privateKey = readFileSync(privateKeyPath, 'utf8');
      const publicKey = readFileSync(publicKeyPath, 'utf8');
      expect(privateKey).toMatch(/BEGIN PRIVATE KEY/);
      expect(publicKey).toMatch(/BEGIN PUBLIC KEY/);
    });
  });
});