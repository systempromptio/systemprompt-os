/**
 * @fileoverview Generate cryptographic keys command for auth module
 * @module modules/core/auth/cli/generatekey
 */

import { generateJWTKeyPair } from '../utils/generate-key.js';

// Local interface definition
export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    
    try {
      // Validate key type
      if (args.type !== 'jwt') {
        console.error('Error: Only JWT key generation is currently supported');
        process.exit(1);
      }
      
      // Determine output directory
      let outputDir = args.output;
      if (!outputDir) {
        // Default to state/auth/keys if no output specified
        outputDir = resolve(context.cwd, 'state/auth/keys');
        
        // Ensure the directory exists
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }
      }
      
      console.log(`Generating ${args.algorithm} keys in ${args.format} format...`);
      
      await generateJWTKeyPair({
        type: args.type,
        algorithm: args.algorithm,
        outputDir: outputDir,
        format: args.format
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
      process.exit(1);
    }
  }
};