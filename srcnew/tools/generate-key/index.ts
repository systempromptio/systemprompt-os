/**
 * Key generation utilities
 */

import { generateKeyPairSync } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface JWTKeyPairOptions {
  type: string;
  algorithm: string;
  outputDir: string;
  format: string;
}

export async function generateJWTKeyPair(options: JWTKeyPairOptions): Promise<void> {
  // Ensure output directory exists
  mkdirSync(options.outputDir, { recursive: true });
  
  // Map algorithm to key type and options
  const keyOptions = {
    RS256: { type: 'rsa', modulusLength: 2048 },
    RS384: { type: 'rsa', modulusLength: 3072 },
    RS512: { type: 'rsa', modulusLength: 4096 },
  }[options.algorithm] || { type: 'rsa', modulusLength: 2048 };
  
  if (options.format === 'pem') {
    // Generate PEM format keys
    const { publicKey, privateKey } = generateKeyPairSync(keyOptions.type as 'rsa', {
      modulusLength: keyOptions.modulusLength,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    writeFileSync(join(options.outputDir, 'private.key'), privateKey);
    writeFileSync(join(options.outputDir, 'public.key'), publicKey);
  } else if (options.format === 'jwk') {
    // Generate JWK format
    const { publicKey, privateKey } = generateKeyPairSync(keyOptions.type as 'rsa', {
      modulusLength: keyOptions.modulusLength,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    // For JWK, we'll create a simple JWKS structure
    // In a real implementation, you'd convert the keys to proper JWK format
    const jwks = {
      keys: [{
        kty: 'RSA',
        alg: options.algorithm,
        use: 'sig',
        kid: `key-${Date.now()}`,
        // In production, you'd extract n, e, d, p, q, dp, dq, qi from the keys
        n: 'mock-modulus',
        e: 'AQAB'
      }]
    };
    
    writeFileSync(join(options.outputDir, 'jwks.json'), JSON.stringify(jwks, null, 2));
  }
}