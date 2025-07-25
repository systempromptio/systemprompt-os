import { generateKeyPairSync } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  TWO
} from '@/const/numbers';
import type { IGenerateKeyOptions } from '@/modules/core/auth/types';

/**
 * Generates RSA key pair for the specified algorithm.
 * @param algorithm - The RSA algorithm to use.
 * @returns Object containing public and private keys.
 */
const generateRsaKeyPair = (
  algorithm: 'RS256' | 'RS512'
): {
  publicKey: string;
  privateKey: string;
} => {
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
  const {
    publicKey,
    privateKey
  } = keyPair;
  return {
    publicKey,
    privateKey
  };
};

/**
 * Generates EC key pair for the specified algorithm.
 * @param algorithm - The EC algorithm to use.
 * @returns Object containing public and private keys.
 */
const generateEcKeyPair = (
  algorithm: 'ES256' | 'ES512'
): {
  publicKey: string;
  privateKey: string;
} => {
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
  const {
    publicKey,
    privateKey
  } = keyPair;
  return {
    publicKey,
    privateKey
  };
};

/**
 * Writes PEM format keys to files.
 * @param outputDir - Directory to write keys to.
 * @param publicKey - Public key content.
 * @param privateKey - Private key content.
 */
const writePemKeys = (outputDir: string, publicKey: string, privateKey: string): void => {
  writeFileSync(join(outputDir, 'private.key'), privateKey);
  writeFileSync(join(outputDir, 'public.key'), publicKey);
};

/**
 * Writes JWK format keys to file.
 * @param outputDir - Directory to write keys to.
 * @param algorithm - The algorithm used.
 * @param keyType - The key type.
 */
const writeJwkKeys = (outputDir: string, algorithm: string, keyType: string): void => {
  const jwks = {
    keys: [
      {
        kty: keyType.toUpperCase(),
        alg: algorithm,
        use: 'sig',
        kid: `${algorithm}-${Date.now().toString()}`,
      },
    ],
  };
  writeFileSync(join(outputDir, 'jwks.json'), JSON.stringify(jwks, null, TWO));
};

/**
 * Generates JWT key pairs based on the provided options.
 * @param options - Configuration options for key generation including algorithm,
 * output directory, and format.
 */
export const generateJwtKeyPair = (options: IGenerateKeyOptions): void => {
  const {
    algorithm,
    outputDir,
    format
  } = options;

  const isRsaAlgorithm = algorithm === 'RS256' || algorithm === 'RS512';
  const keyType = isRsaAlgorithm ? 'rsa' : 'ec';

  const keys = isRsaAlgorithm
    ? generateRsaKeyPair(algorithm as 'RS256' | 'RS512')
    : generateEcKeyPair(algorithm as 'ES256' | 'ES512');

  if (format === 'pem') {
    writePemKeys(outputDir, keys.publicKey, keys.privateKey);
  } else {
    writeJwkKeys(outputDir, algorithm, keyType);
  }
};
