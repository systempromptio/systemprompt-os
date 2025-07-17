/**
 * @fileoverview Generate cryptographic keys command
 * @module tools/cli/commands/generatekey
 */

import { CommandModule } from '../types.js';
import { generateJWTKeyPair } from '../../../generate-key/index.js';

export const generateKeyCommand: CommandModule = {
  name: 'generatekey',
  description: 'Generate cryptographic keys for JWT signing',
  
  options: [
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: 'Key type (currently only "jwt" is supported)',
      default: 'jwt'
    },
    {
      name: 'algorithm',
      alias: 'a',
      type: 'string',
      description: 'Algorithm (RS256 or RS512)',
      default: 'RS256'
    },
    {
      name: 'output',
      alias: 'o',
      type: 'string',
      description: 'Output directory',
      default: process.cwd()
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (pem or jwk)',
      default: 'pem'
    }
  ],
  
  async execute(args: any): Promise<void> {
    try {
      if (args.type !== 'jwt') {
        console.error('Error: Only JWT key generation is currently supported');
        process.exit(1);
      }
      
      await generateJWTKeyPair({
        type: args.type,
        algorithm: args.algorithm,
        outputDir: args.output,
        format: args.format
      });
    } catch (error) {
      console.error('Error generating keys:', error);
      process.exit(1);
    }
  }
};