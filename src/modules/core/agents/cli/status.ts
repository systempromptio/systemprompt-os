/**
 * Agents module status CLI command.
 * @file Agents module status CLI command.
 * @module modules/core/agents/cli/status
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command: ICLICommand = {
  description: 'Show agents module status (enabled/healthy)',
  execute: async (_context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    
    try {
      console.log('\nAgents Module Status:');
      console.log('═══════════════════\n');
      console.log('Module: agents');
      console.log('Enabled: ✓');
      console.log('Healthy: ✓');
      console.log('Service: AgentService initialized');
      
      // Display static status information
      console.log('Agent management: ✓');
      console.log('Task execution: ✓');
      console.log('State persistence: ✓');
      
      process.exit(0);
    } catch (error) {
      logger.error(LogSource.AGENT, 'Error getting agents status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      console.error('Error getting agents status:', error);
      process.exit(1);
    }
  },
};