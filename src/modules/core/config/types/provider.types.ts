/**
 * Provider types for configuration module.
 * @file Provider types for configuration module.
 * @module modules/core/config/types/provider
 */

import type { IProvider as BaseProvider } from '@/modules/core/config/providers';
import type { IProviderConfig } from '@/modules/core/config/types/model.types';

/**
 * Extended provider interface with typed config.
 */
export interface IProvider extends BaseProvider {
  config?: IProviderConfig;
}
