/**
 * System backup command
 */

import { Container } from 'typedi';
import type { CLIContext } from '@/modules/types.js';
import { SystemModule } from '../index.js';
import { formatBytes } from '../utils/format.js';

export const command = {
  async execute(context: CLIContext): Promise<void> {
    try {
      // Get system module from container
      const systemModule = Container.get(SystemModule);
      await systemModule.initialize();

      console.log('Creating system backup...\n');

      // Parse include option
      const includeArg = context.args['include'] || 'all';
      const include = typeof includeArg === 'string' ? includeArg : String(includeArg);
      const options = {
        includeConfig: include === 'all' || include.includes('config'),
        includeData: include === 'all' || include.includes('data'),
        includeModules: include === 'all' || include.includes('modules'),
        compress: context.args['compress'] !== false,
      };

      console.log('Backup options:');
      console.log(`  Include config:  ${options.includeConfig ? 'Yes' : 'No'}`);
      console.log(`  Include data:    ${options.includeData ? 'Yes' : 'No'}`);
      console.log(`  Include modules: ${options.includeModules ? 'Yes' : 'No'}`);
      console.log(`  Compress:        ${options.compress ? 'Yes' : 'No'}`);
      console.log('');

      // Create backup
      const startTime = Date.now();
      const backup = await systemModule.createBackup(options);
      const duration = Date.now() - startTime;

      console.log('\nBackup completed successfully!');
      console.log(`  Backup ID:   ${backup.id}`);
      console.log(`  Location:    ${backup.path}`);
      console.log(`  Size:        ${formatBytes(backup.size)}`);
      console.log(`  Components:  ${backup.components.join(', ')}`);
      console.log(`  Duration:    ${(duration / 1000).toFixed(2)}s`);

      console.log('\nTo restore this backup, run:');
      console.log(`  systemprompt system:restore --file ${backup.id}`);
    } catch (error) {
      console.error('Error creating backup:', error);
      process.exit(1);
    }
  },
};
