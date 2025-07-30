/**
 * @file Generate cryptographic keys command for auth module.
 * @module modules/core/auth/cli/generatekey
 */

import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { generateKeyPairSync } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ONE } from '@/constants/numbers';
import type { ICliContext } from '@/modules/core/auth/types/cli.types';

export const command = {
  description: 'Generate cryptographic keys for JWT signing',
  arguments: [
    {
      name: 'type',
      description: 'Type of key to generate (jwt)',
      required: true,
    },
  ],
  options: {
    output: {
      short: 'o',
      description: 'Output directory for keys (default: ./state/auth/keys)',
    },
    force: {
      short: 'f',
      description: 'Overwrite existing keys',
    },
  },
  execute: async (context: ICliContext): Promise<void> => {
    const { args } = context;

    try {
      if (args.type !== 'jwt') {
        console.error('Error: Only JWT key generation is currently supported');
        process.exit(ONE);
      }

      let outputDir = args.output;
      if (!outputDir) {
        outputDir = resolve(context.cwd, 'state/auth/keys');

        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }
      }

      console.log(`Generating ${args.algorithm ?? 'default'} keys in ${args.format ?? 'default'} format...`);

      const keyPair = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      writeFileSync(join(outputDir, 'private.key'), keyPair.privateKey);
      writeFileSync(join(outputDir, 'public.key'), keyPair.publicKey);

      console.log(`✓ Keys generated successfully in: ${outputDir}`);

      if (args.format === 'pem') {
        console.log('  - private.key');
        console.log('  - public.key');
      } else if (args.format === 'jwk') {
        console.log('  - jwks.json');
      }
    } catch (error) {
      console.error('Error generating keys:', error);
      process.exit(ONE);
    }
  },
};
