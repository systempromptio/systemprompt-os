import { generateKeyPairSync } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  TWO
} from '@/const/numbers';

// Constants are already imported above

/**
 *
 * IGenerateKeyOptions interface.
 *
 */

export interface IGenerateKeyOptions {
  type: 'jwt';
  algorithm: 'RS256' | 'RS512' | 'ES256' | 'ES512';
  outputDir: string;
  format: 'pem' | 'jwk';
}

/**
 * TODO: Refactor this function to reduce complexity.
 * @param options
 */
export async function generateJWTKeyPair(options: IGenerateKeyOptions): Promise<void> {
  const {
 algorithm, outputDir, format
} = options;

  const keyType = algorithm.startsWith('RS') ? 'rsa' : 'ec';

  let publicKey: string;
  let privateKey: string;

  if (keyType === 'rsa') {
    const keyPair = generateKeyPairSync('rsa', {
      modulusLength: algorithm === 'RS256' ? 2048 : 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });
    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;
  } else {
    const keyPair = generateKeyPairSync('ec', {
      namedCurve: algorithm === 'ES256' ? 'prime256v1' : 'secp521r1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });
    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;
  }

  if (format === 'pem') {
    writeFileSync(join(outputDir, 'private.key'), privateKey);
    writeFileSync(join(outputDir, 'public.key'), publicKey);
  } else {
    const jwks = {
      keys: [
        {
          kty: keyType.toUpperCase(),
          alg: algorithm,
          use: 'sig',
          kid: `${algorithm}-${Date.now()}`,
        },
      ],
    };

    writeFileSync(join(outputDir, 'jwks.json'), JSON.stringify(jwks, null, TWO));
  }
}
