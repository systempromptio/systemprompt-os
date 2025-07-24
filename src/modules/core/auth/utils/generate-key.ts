/**
 * @file JWT key generation utilities.
 * @module modules/core/auth/utils/generate-key
 */

import { generateKeyPairSync } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';

export interface GenerateKeyOptions {
  type: 'jwt';
  algorithm: 'RS256' | 'RS512' | 'ES256' | 'ES512';
  outputDir: string;
  format: 'pem' | 'jwk';
}

export async function generateJWTKeyPair(options: GenerateKeyOptions): Promise<void> {
  const {
 algorithm, outputDir, format
} = options;

  // Map algorithm to key type
  const keyType = algorithm.startsWith('RS') ? 'rsa' : 'ec';

  // Generate key pair with proper typing
  let publicKey: string;
  let privateKey: string;

  if (keyType === 'rsa') {
    const keyPair = generateKeyPairSync('rsa', {
      modulusLength: algorithm === 'RS256' ? 2048 : 4096,
      publicKeyEncoding: {
 type: 'spki',
format: 'pem'
},
      privateKeyEncoding: {
 type: 'pkcs8',
format: 'pem'
}
    });
    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;
  } else {
    const keyPair = generateKeyPairSync('ec', {
      namedCurve: algorithm === 'ES256' ? 'prime256v1' : 'secp521r1',
      publicKeyEncoding: {
 type: 'spki',
format: 'pem'
},
      privateKeyEncoding: {
 type: 'pkcs8',
format: 'pem'
}
    });
    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;
  }

  if (format === 'pem') {
    // Write PEM files
    writeFileSync(join(outputDir, 'private.key'), privateKey);
    writeFileSync(join(outputDir, 'public.key'), publicKey);
  } else {
    // Convert to JWK format
    const jwks = {
      keys: [{
        kty: keyType.toUpperCase(),
        alg: algorithm,
        use: 'sig',
        kid: `${algorithm}-${Date.now()}`,
        /*
         * Note: In production, you'd need proper JWK conversion
         * This is simplified for the example
         */
      }]
    };

    writeFileSync(join(outputDir, 'jwks.json'), JSON.stringify(jwks, null, 2));
  }
}
