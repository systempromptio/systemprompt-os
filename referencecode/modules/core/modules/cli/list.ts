/**
 * @fileoverview List installed modules CLI command
 * @module modules/core/modules/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';
import type { ModuleManagerService } from '../services/module-manager.service.js';
import Table from 'cli-table3';

export function createListCommand(service: ModuleManagerService, _logger?: Logger): Command {
  return new Command('list')
    .description('List installed modules')
    .option('-t, --type <type>', 'Filter by type (module, server, all)', 'all')
    .option('-f, --format <format>', 'Output format (text, json, table)', 'text')
    .action(async (options) => {
      try {
        // Get extensions based on type filter
        const extensions =
          options.type === 'all'
            ? service.getExtensions()
            : service.getExtensions(options.type as any);

        if (extensions.length === 0) {
          console.log('No modules found');
          process.exit(0);
        }

        if (options.format === 'json') {
          console.log(JSON.stringify(extensions, null, 2));
        } else if (options.format === 'table') {
          const table = new Table({
            head: ['Name', 'Version', 'Type', 'Status', 'Description'],
            style: { head: ['cyan'] },
          });

          extensions.forEach((ext) => {
            table.push([
              ext.name,
              ext.version,
              ext.type,
              ext.enabled ? '✅ Enabled' : '❌ Disabled',
              ext.description || '-',
            ]);
          });

          console.log(table.toString());
        } else {
          // Text format
          console.log(`Found ${extensions.length} module(s):\n`);
          extensions.forEach((ext) => {
            const status = ext.enabled ? '✅' : '❌';
            console.log(`${status} ${ext.name} (v${ext.version})`);
            console.log(`   Type: ${ext.type}`);
            if (ext.description) {
              console.log(`   Description: ${ext.description}`);
            }
            console.log();
          });
        }

        process.exit(0);
      } catch (error) {
        console.error(`❌ Error listing modules: ${error}`);
        process.exit(1);
      }
    });
}
