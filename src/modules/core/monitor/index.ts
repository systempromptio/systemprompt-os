/* eslint-disable systemprompt-os/no-block-comments */
/**
 * Monitor module exports.
 * System monitoring and performance tracking functionality.
 */

import { getCommands } from '@/modules/core/monitor/cli/index.js';
import { MonitorService } from '@/modules/core/monitor/services/monitor.service.js';

/**
 * Initialize function for core module pattern.
 * @returns Promise that resolves when initialized.
 */
export const initialize = async (): Promise<void> => {
  const service = MonitorService.getInstance();
  await service.initialize();
};

/**
 * Export CLI commands for module loader.
 */
export { getCommands };

/**
 * Export service for external use.
 */
export { MonitorService };

/**
 * Re-export enums for convenience.
 */
export {
  MetricTypeEnum,
  AlertSeverityEnum,
  AlertComparisonEnum
} from '@/modules/core/monitor/types/index.js';
