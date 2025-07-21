/**
 * @fileoverview Unit tests for generate-key utilities
 * @module tests/unit/modules/core/auth/utils/generate-key
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateJWTKeyPair, GenerateKeyOptions } from '../../../../../../src/modules/core/auth/utils/generate-key';
import { generateKeyPairSync } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Mock dependencies
vi.mock('crypto');
vi.mock('fs');
vi.mock('path', () => ({
  join: vi.fn((...args: string[]) => args.join('/'))
}));

describe('generateJWTKeyPair', () => {
  let mockRSAKeyPair: any;
  let mockECKeyPair: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock RSA key pair
    mockRSAKeyPair = {
      publicKey: '-----BEGIN PUBLIC KEY-----\nRSA_PUBLIC_KEY\n-----END PUBLIC KEY-----',
      privateKey: '-----BEGIN PRIVATE KEY-----\nRSA_PRIVATE_KEY\n-----END PRIVATE KEY-----'
    };
    
    // Mock EC key pair
    mockECKeyPair = {
      publicKey: '-----BEGIN PUBLIC KEY-----\nEC_PUBLIC_KEY\n-----END PUBLIC KEY-----',
      privateKey: '-----BEGIN PRIVATE KEY-----\nEC_PRIVATE_KEY\n-----END PRIVATE KEY-----'
    };
  });
  
  describe('RSA key generation', () => {
    it('generates RS256 keys in PEM format', async () => {
      vi.mocked(generateKeyPairSync).mockReturnValue(mockRSAKeyPair);
      
      const options: GenerateKeyOptions = {
        type: 'jwt',
        algorithm: 'RS256',
        outputDir: '/output',
        format: 'pem'
      };
      
      await generateJWTKeyPair(options);
      
      expect(generateKeyPairSync).toHaveBeenCalledWith('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      
      expect(writeFileSync).toHaveBeenCalledWith(
        '/output/private.key',
        mockRSAKeyPair.privateKey
      );
      expect(writeFileSync).toHaveBeenCalledWith(
        '/output/public.key',
        mockRSAKeyPair.publicKey
      );
    });
    
    it('generates RS512 keys with larger modulus', async () => {
      vi.mocked(generateKeyPairSync).mockReturnValue(mockRSAKeyPair);
      
      const options: GenerateKeyOptions = {
        type: 'jwt',
        algorithm: 'RS512',
        outputDir: '/keys',
        format: 'pem'
      };
      
      await generateJWTKeyPair(options);
      
      expect(generateKeyPairSync).toHaveBeenCalledWith('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
    });
  });
  
  describe('EC key generation', () => {
    it('generates ES256 keys in PEM format', async () => {
      vi.mocked(generateKeyPairSync).mockReturnValue(mockECKeyPair);
      
      const options: GenerateKeyOptions = {
        type: 'jwt',
        algorithm: 'ES256',
        outputDir: '/output',
        format: 'pem'
      };
      
      await generateJWTKeyPair(options);
      
      expect(generateKeyPairSync).toHaveBeenCalledWith('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      
      expect(writeFileSync).toHaveBeenCalledWith(
        '/output/private.key',
        mockECKeyPair.privateKey
      );
      expect(writeFileSync).toHaveBeenCalledWith(
        '/output/public.key',
        mockECKeyPair.publicKey
      );
    });
    
    it('generates ES512 keys with secp521r1 curve', async () => {
      vi.mocked(generateKeyPairSync).mockReturnValue(mockECKeyPair);
      
      const options: GenerateKeyOptions = {
        type: 'jwt',
        algorithm: 'ES512',
        outputDir: '/keys',
        format: 'pem'
      };
      
      await generateJWTKeyPair(options);
      
      expect(generateKeyPairSync).toHaveBeenCalledWith('ec', {
        namedCurve: 'secp521r1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
    });
  });
  
  describe('JWK format', () => {
    it('generates RSA keys in JWK format', async () => {
      vi.mocked(generateKeyPairSync).mockReturnValue(mockRSAKeyPair);
      const mockDate = 1234567890;
      vi.spyOn(Date, 'now').mockReturnValue(mockDate);
      
      const options: GenerateKeyOptions = {
        type: 'jwt',
        algorithm: 'RS256',
        outputDir: '/output',
        format: 'jwk'
      };
      
      await generateJWTKeyPair(options);
      
      expect(writeFileSync).toHaveBeenCalledTimes(1);
      const [path, content] = vi.mocked(writeFileSync).mock.calls[0];
      
      expect(path).toBe('/output/jwks.json');
      
      const jwks = JSON.parse(content as string);
      expect(jwks).toEqual({
        keys: [{
          kty: 'RSA',
          alg: 'RS256',
          use: 'sig',
          kid: `RS256-${mockDate}`
        }]
      });
    });
    
    it('generates EC keys in JWK format', async () => {
      vi.mocked(generateKeyPairSync).mockReturnValue(mockECKeyPair);
      const mockDate = 9876543210;
      vi.spyOn(Date, 'now').mockReturnValue(mockDate);
      
      const options: GenerateKeyOptions = {
        type: 'jwt',
        algorithm: 'ES256',
        outputDir: '/jwk-output',
        format: 'jwk'
      };
      
      await generateJWTKeyPair(options);
      
      const [path, content] = vi.mocked(writeFileSync).mock.calls[0];
      
      expect(path).toBe('/jwk-output/jwks.json');
      
      const jwks = JSON.parse(content as string);
      expect(jwks).toEqual({
        keys: [{
          kty: 'EC',
          alg: 'ES256',
          use: 'sig',
          kid: `ES256-${mockDate}`
        }]
      });
    });
    
    it('formats JWK JSON with proper indentation', async () => {
      vi.mocked(generateKeyPairSync).mockReturnValue(mockRSAKeyPair);
      
      const options: GenerateKeyOptions = {
        type: 'jwt',
        algorithm: 'RS256',
        outputDir: '/output',
        format: 'jwk'
      };
      
      await generateJWTKeyPair(options);
      
      const [, content] = vi.mocked(writeFileSync).mock.calls[0];
      
      // Check that JSON is properly formatted with 2-space indentation
      expect(content).toContain('{\n  "keys"');
      expect(content).toContain('\n    ');
    });
  });
});