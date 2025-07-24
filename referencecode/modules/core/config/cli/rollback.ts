/**
 * @fileoverview Rollback configuration changes command
 * @module modules/core/config/cli/rollback
 */

import { ConfigModule } from '../index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Execute rollback command
 */
async function execute(options: { to: string; key?: string; 'dry-run'?: boolean }): Promise<void> {
  if (!options.to) {
    console.error('Error: Rollback target is required (use --to)');
    process.exit(1);
  }

  const dryRun = options['dry-run'] || false;

  try {
    const configModule = new ConfigModule();
    await configModule.initialize();

    // For this simplified implementation, we'll check for backup files
    const configPath = './state/config';
    const backupDir = path.join(configPath, 'backups');

    let rollbackFile: string;

    if (options.to === 'last') {
      // Find the most recent backup
      try {
        const files = await fs.readdir(backupDir);
        const backupFiles = files.filter(
          (f) => f.startsWith('config-backup-') && f.endsWith('.json'),
        );

        if (backupFiles.length === 0) {
          console.error('Error: No backup files found to rollback to');
          process.exit(1);
        }

        // Sort by timestamp in filename
        backupFiles.sort((a, b) => {
          const timestampA = parseInt(a.match(/config-backup-(\d+)\.json/)?.[1] || '0');
          const timestampB = parseInt(b.match(/config-backup-(\d+)\.json/)?.[1] || '0');
          return timestampB - timestampA;
        });

        if (backupFiles.length === 0) {
          console.error('Error: No backup files found');
          process.exit(1);
        }
        rollbackFile = path.join(backupDir, backupFiles[0]!);
      } catch {
        console.error('Error: No backup directory found');
        process.exit(1);
      }
    } else if (options.to.match(/^\d+$/)) {
      // Timestamp format
      rollbackFile = path.join(backupDir, `config-backup-${options.to}.json`);
    } else {
      // Direct file path
      rollbackFile = path.resolve(options.to);
    }

    // Check if rollback file exists
    try {
      await fs.access(rollbackFile);
    } catch {
      console.error(`Error: Rollback file not found: ${rollbackFile}`);
      process.exit(1);
    }

    // Read the rollback configuration
    const rollbackContent = await fs.readFile(rollbackFile, 'utf-8');
    const rollbackConfig = JSON.parse(rollbackContent);

    // Get current configuration
    const currentConfig = configModule.get() || {};

    // Show what will be changed
    console.log('\nRollback Preview');
    console.log('='.repeat(60));
    console.log(`Rollback source: ${rollbackFile}`);

    if (options.key) {
      // Rollback specific key only
      console.log(`Rolling back key: ${options.key}`);

      const currentValue = getNestedValue(currentConfig, options.key);
      const rollbackValue = getNestedValue(rollbackConfig, options.key);

      console.log(`\nCurrent value: ${JSON.stringify(currentValue)}`);
      console.log(`Rollback to: ${JSON.stringify(rollbackValue)}`);

      if (dryRun) {
        console.log('\n--- DRY RUN MODE ---');
        console.log('No changes have been made.');
        return;
      }

      // Apply the rollback for specific key
      await configModule.set(options.key, rollbackValue);
      console.log('\n✓ Configuration key rolled back successfully');
    } else {
      // Full rollback
      console.log('Rolling back entire configuration');

      if (dryRun) {
        console.log('\n--- DRY RUN MODE ---');
        console.log('The following configuration would be restored:');
        console.log(JSON.stringify(rollbackConfig, null, 2));
        console.log('\nNo changes have been made.');
        return;
      }

      // Create a backup of current config before rollback
      const timestamp = Date.now();
      const backupPath = path.join(backupDir, `config-backup-${timestamp}.json`);
      await fs.mkdir(backupDir, { recursive: true });
      await fs.writeFile(backupPath, JSON.stringify(currentConfig, null, 2));
      console.log(`\nBackup created: ${backupPath}`);

      // Apply the rollback
      for (const [key, value] of Object.entries(rollbackConfig)) {
        await configModule.set(key, value);
      }

      console.log('\n✓ Configuration rolled back successfully');
    }
  } catch (error) {
    console.error(
      `Error during rollback: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Command export for CLI discovery
 */
export const command = {
  execute,
};
