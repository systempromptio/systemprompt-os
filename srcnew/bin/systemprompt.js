#!/usr/bin/env node

/**
 * @fileoverview systemprompt CLI
 */

import { Command } from 'commander';
import { generateJWTKeyPair } from '../dist/tools/generate-key/index.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('systemprompt')
  .description('CLI for systemprompt-os')
  .version(packageJson.version);

// Generate key command
program
  .command('generatekey')
  .description('Generate cryptographic keys for JWT signing')
  .option('-t, --type <type>', 'Key type (currently only "jwt" is supported)', 'jwt')
  .option('-a, --algorithm <algorithm>', 'Algorithm (RS256 or RS512)', 'RS256')
  .option('-o, --output <dir>', 'Output directory', process.cwd())
  .option('-f, --format <format>', 'Output format (pem or jwk)', 'pem')
  .action(async (options) => {
    try {
      if (options.type !== 'jwt') {
        console.error('Error: Only JWT key generation is currently supported');
        process.exit(1);
      }
      
      await generateJWTKeyPair({
        type: options.type,
        algorithm: options.algorithm,
        outputDir: options.output,
        format: options.format
      });
    } catch (error) {
      console.error('Error generating keys:', error);
      process.exit(1);
    }
  });

// Start command (placeholder)
program
  .command('start')
  .description('Start the systemprompt-os server')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .action((options) => {
    console.log(`Starting systemprompt-os on port ${options.port}...`);
    // TODO: Implement server start
  });

// Status command (placeholder)
program
  .command('status')
  .description('Check systemprompt-os status')
  .action(() => {
    console.log('systemprompt-os status: Not implemented yet');
    // TODO: Implement status check
  });

program.parse();