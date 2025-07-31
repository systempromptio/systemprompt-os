/**
 * Sync Rules CLI Command.
 * @file CLI command for syncing module rules.
 * @module dev/cli
 * Provides command-line interface for rules synchronization.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { RulesSyncService } from '@/modules/core/dev/services/rules-sync.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command: ICLICommand = {
  description: 'Sync generic rules to specific modules with placeholder replacement',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const service = RulesSyncService.getInstance();
      service.setLogger(logger);
      await service.initialize();

      const targetModule = (args._ as string[] | undefined)?.[0];

      cliOutput.section('SystemPrompt OS Rules Sync');

      if (targetModule) {
        cliOutput.info(`Syncing rules for module: ${targetModule}`);

        const result = await service.syncModuleRules(targetModule);

        if (result.success) {
          cliOutput.success(`✓ ${result.message}`);
          cliOutput.keyValue({
            'Files processed': result.filesProcessed.toString(),
            'Module': targetModule
          });
        } else {
          cliOutput.error(`✗ ${result.message}`);
          if (result.errors.length > 0) {
            cliOutput.section('Errors:');
            result.errors.forEach(error => { cliOutput.error(`  - ${error}`); });
          }
          process.exit(1);
        }
      } else {
        cliOutput.info('Syncing rules for all modules...');

        const results = await service.syncAllModules();

        const successful = results.filter(r => { return r.success });
        const failed = results.filter(r => { return !r.success });
        const totalFiles = results.reduce((sum, r) => { return sum + r.filesProcessed }, 0);
        const totalErrors = results.reduce((sum, r) => { return sum + r.errors.length }, 0);

        cliOutput.section('Summary:');
        cliOutput.keyValue({
          'Modules processed': results.length.toString(),
          'Successful': successful.length.toString(),
          'Failed': failed.length.toString(),
          'Total files synced': totalFiles.toString(),
          'Total errors': totalErrors.toString()
        });

        if (successful.length > 0) {
          cliOutput.section('✓ Successful modules:');
          successful.forEach(result => {
            const moduleName = result.message.split(' ').pop();
            cliOutput.success(`  - ${moduleName} (${result.filesProcessed} files)`);
          });
        }

        if (failed.length > 0) {
          cliOutput.section('✗ Failed modules:');
          failed.forEach(result => {
            const moduleName = result.message.split(' ').pop();
            cliOutput.error(`  - ${moduleName}: ${result.message}`);
            result.errors.forEach(error => { cliOutput.error(`    • ${error}`); });
          });
          process.exit(1);
        }

        cliOutput.success('Rules sync completed successfully!');
      }

      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      cliOutput.error(`Error: ${errorMessage}`);
      logger.error(LogSource.DEV, 'Rules sync command failed', { error: errorMessage });
      process.exit(1);
    }
  },
};
