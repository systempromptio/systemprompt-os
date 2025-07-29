/**
 * Dev session start CLI command.
 * @file Dev session start CLI command.
 * @module dev/cli
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { getDevModuleAsync } from '@/modules/core/dev/index';
import { DevSessionType } from '@/modules/core/dev/types/index';

export const command: ICLICommand = {
  description: `Start a new development session (types: ${Object.values(DevSessionType).join(', ')})`,
  options: [
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: 'Session type (required)',
      required: true
    },
    {
      name: 'profile',
      alias: 'p',
      type: 'string',
      description: 'Associate with profile'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const type = args.type as string;
      if (!type) {
        cliOutput.error('Session type is required. Use --type or -t flag.');
        process.exit(1);
      }

      if (!Object.values(DevSessionType).includes(type as DevSessionType)) {
        cliOutput.error(`Invalid session type: ${type}. Valid types: ${Object.values(DevSessionType).join(', ')}`);
        process.exit(1);
      }

      const module = await getDevModuleAsync();
      const service = module.exports.service();

      let profileId: number | undefined;
      if (args.profile) {
        const profile = await service.getProfile(args.profile as string);
        if (!profile) {
          cliOutput.error(`Profile "${args.profile}" not found`);
          process.exit(1);
        }
        profileId = profile.id;
      }

      const session = await service.startSession(type as DevSessionType, profileId);

      cliOutput.success(`Started ${type} session with ID: ${session.id}`);

      cliOutput.section('Session Details');
      cliOutput.keyValue({
        ID: session.id,
        Type: session.type,
        Status: 'active',
        Profile: args.profile ? args.profile as string : 'None',
        Started: new Date(session.started_at ?? '').toLocaleString()
      });

      cliOutput.info(`Tip: End this session with: dev session:end ${session.id}`);

      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(LogSource.DEV, `Error starting session: ${errorMessage}`);
      cliOutput.error(`Error starting session: ${errorMessage}`);
      process.exit(1);
    }
  }
};
