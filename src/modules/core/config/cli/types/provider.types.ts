/**
 * Provider CLI command types.
 * @file Provider CLI command types.
 * @module modules/core/config/cli/types/provider
 */

import type { IProviderConfig } from '@/modules/core/config/types/model.types';

/**
 * Extended provider interface with version and typed config.
 */
export interface IProviderWithVersion {
  name: string;
  displayName: string;
  enabled: boolean;
  version: string;
  description: string;
  config?: IProviderConfig;
}

/**
 * Command options interface for provider commands.
 */
export interface ICommandOptions {
  enabled?: boolean;
  name?: string;
  models?: boolean;
}
