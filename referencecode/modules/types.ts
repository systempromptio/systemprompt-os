/**
 * Re-export core types for backward compatibility
 */
export { TYPES } from '@/modules/core/types.js';

// Re-export module types
export type { IModule as ModuleInterface } from '@/modules/core/modules/types/index.js';
export { ModuleStatus } from '@/modules/core/modules/types/index.js';
export type { ILogger as Logger } from '@/modules/core/logger/types/index.js';
export type { IDatabaseService } from '@/modules/core/database/types/index.js';

// Re-export module context type
export interface ModuleContext {
  config?: Record<string, unknown>;
  logger?: ILogger;
  database?: IDatabaseService;
}

import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { IDatabaseService } from '@/modules/core/database/types/index.js';

// Re-export CLI types
export type { CLIContext } from './types/cli.types.js';