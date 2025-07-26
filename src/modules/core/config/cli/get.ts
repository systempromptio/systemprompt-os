/**
 * @file Config get CLI command.
 * @module modules/core/config/cli/get
 */

import { ConfigModule } from '@/modules/core/config/index';
import type { ICLIContext } from '@/modules/core/cli/types/index';

export const command = {
  description: 'Get configuration value(s)',
  execute: async (context: ICLIContext | { key?: string }): Promise<void> => {
    let key: string | undefined;
    if ('args' in context) {
      key = context.args?.key as string | undefined;
    } else {
      key = context.key;
    }

    const configModule = new ConfigModule();
    await configModule.initialize();

    const value = await configModule.get(key);

    if (key && value === undefined) {
      console.error(`Configuration key '${key}' not found.`);
      process.exit(1);
    }

    if (!key && value === undefined) {
      console.log('No configuration values found.');
      return;
    }

    try {
      console.log(JSON.stringify(value, null, 2));
    } catch (error) {
      console.error('Error serializing configuration value:', error);
      process.exit(1);
    }
  },
};
