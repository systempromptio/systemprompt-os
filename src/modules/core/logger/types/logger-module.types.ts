/**
 * Logger module exports interface.
 */

import type { ILogger } from '@/modules/core/logger/types/index';
import type { LoggerService } from '@/modules/core/logger/services/logger.service';

/**
 * Strongly typed exports interface for Logger module.
 */
export interface ILoggerModuleExports {
  readonly service: () => ILogger;
  readonly logger: () => ILogger;
  readonly getInstance: () => LoggerService;
}
