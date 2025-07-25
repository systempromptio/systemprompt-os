/**
 * @fileoverview Show module info CLI command
 * @module modules/core/modules/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';
import type { ModuleManagerService } from '../services/module-manager.service.js';
import { existsSync, readdirSync } from 'fs';

export function createInfoCommand(service: ModuleManagerService, _logger?: Logger): Command {
  return new Command('info')
    .description('Show detailed information about a module')
    .requiredOption('-n, --name <name>', 'Module name')
    .action(async (options) => {
      try {
        const moduleInfo = service.getExtension(options.name);
        if (!moduleInfo) {
          console.error(`Module '${options.name}' not found`);
          process.exit(1);
        }

        console.log(`Module Information: ${moduleInfo.name}\n`);
        console.log(`Name:        ${moduleInfo.name}`);
        console.log(`Version:     ${moduleInfo.version}`);
        console.log(`Type:        ${moduleInfo.type}`);
        console.log(`Status:      ${moduleInfo.enabled ? '✅ Enabled' : '❌ Disabled'}`);

        if (moduleInfo.description) {
          console.log(`Description: ${moduleInfo.description}`);
        }

        if (moduleInfo.author) {
          console.log(`Author:      ${moduleInfo.author}`);
        }

        if (moduleInfo.path) {
          console.log(`Path:        ${moduleInfo.path}`);
        }

        // Check for additional module details
        if (moduleInfo.dependencies && moduleInfo.dependencies.length > 0) {
          console.log('\nDependencies:');
          moduleInfo.dependencies.forEach((dep) => {
            console.log(`  - ${dep}`);
          });
        }

        if (moduleInfo.exports && moduleInfo.exports['length'] > 0) {
          console.log('\nExports:');
          moduleInfo.exports['forEach']((exp: any) => {
            console.log(`  - ${exp}`);
          });
        }

        // Check for CLI commands
        if (moduleInfo.cli?.['commands'] && Array.isArray(moduleInfo.cli['commands']) && moduleInfo.cli['commands'].length > 0) {
          console.log('\nCLI Commands:');
          moduleInfo.cli['commands'].forEach((cmd: any) => {
            console.log(`  - ${cmd.name}: ${cmd.description}`);
          });
        }

        // Check directory structure if path exists
        if (moduleInfo.path && existsSync(moduleInfo.path)) {
          console.log('\nDirectory Structure:');
          try {
            const files = readdirSync(moduleInfo.path);
            files.forEach((file) => {
              console.log(`  - ${file}`);
            });
          } catch {
            console.log('  (Unable to read directory)');
          }
        }

        process.exit(0);
      } catch (error) {
        console.error(`❌ Error getting module info: ${error}`);
        process.exit(1);
      }
    });
}
