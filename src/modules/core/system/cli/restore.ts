/**
 * System restore command
 */

import type { CLIContext } from '../../../../cli/src/types.js';
import { SystemModule } from '../index.js';
import { existsSync } from 'fs';
import { join } from 'path';

export const command = {
  async execute(context: CLIContext): Promise<void> {
    try {
      if (!context.args.file) {
        console.error('Error: Backup file/ID is required');
        console.error('Usage: systemprompt system:restore --file <backup-id>');
        process.exit(1);
      }
      
      // Initialize system module
      const systemModule = new SystemModule();
      await systemModule.initialize({ 
        logger: console,
        config: {
          backup: {
            enabled: true,
            path: './backups'
          }
        }
      });
      
      const backupId = context.args.file;
      const components = context.args.components || 'all';
      
      // Check if backup exists
      const backupPath = join('./backups', backupId);
      const compressedPath = `${backupPath}.tar.gz`;
      
      if (!existsSync(backupPath) && !existsSync(compressedPath)) {
        console.error(`Error: Backup not found: ${backupId}`);
        console.error('\nAvailable backups:');
        
        // List available backups
        const { readdirSync } = require('fs');
        const backups = readdirSync('./backups')
          .filter((f: string) => f.startsWith('backup-'))
          .map((f: string) => f.replace('.tar.gz', ''));
        
        backups.forEach((b: string) => console.error(`  - ${b}`));
        process.exit(1);
      }
      
      console.log(`Restoring from backup: ${backupId}`);
      console.log(`Components to restore: ${components}\n`);
      
      // Confirm restore
      if (!context.args.confirm) {
        console.log('WARNING: This will overwrite existing data!');
        console.log('To confirm, run with --confirm flag');
        process.exit(0);
      }
      
      // Perform restore
      const startTime = Date.now();
      await systemModule.restoreBackup(backupId, { components });
      const duration = Date.now() - startTime;
      
      console.log('\nRestore completed successfully!');
      console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);
      console.log('\nPlease restart the system for changes to take effect.');
    } catch (error) {
      console.error('Error restoring backup:', error);
      process.exit(1);
    }
  }
};