/* eslint-disable no-console */
/* eslint-disable func-style */
/* eslint-disable max-lines-per-function */
/* eslint-disable max-statements */
/* eslint-disable no-underscore-dangle */
/**
 *  *  * @file Generate cryptographic keys command for auth module.
 * @module modules/core/auth/cli/generatekey
 */

import { generateJWTKeyPair } from '@/modules/core/auth/utils/generate-key.js';

/**
 *  *  * CLIContext interface.
 */
export
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ONE } from '@/modules/core/auth/constants';
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
  execute: async (_context: ICliContext): Promise<void> => => {
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

      console.log(`Generating ${args.algorithm} keys in ${args.format} format...`);

      await generateJWTKeyPair({
        type: args.type,
        algorithm: args.algorithm,
        outputDir,
        format: args.format,
      });

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
