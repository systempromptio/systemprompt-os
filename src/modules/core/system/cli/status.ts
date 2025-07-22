/**
 * System status command
 */

import type { CLIContext } from '../../../../cli/src/types.js';
import { SystemModule } from '../index.js';
import { formatBytes, formatDuration } from '../utils/format.js';

export const command = {
  async execute(context: CLIContext): Promise<void> {
    try {
      // Initialize system module
      const systemModule = new SystemModule();
      await systemModule.initialize({ logger: console });
      
      // Get system status
      const status = await systemModule.getSystemStatus();
      
      const format = context.args.format || 'table';
      const detailed = context.args.detailed || false;
      
      if (format === 'json') {
        console.log(JSON.stringify(status, null, 2));
      } else if (format === 'yaml') {
        const yaml = await import('yaml');
        console.log(yaml.stringify(status));
      } else {
        // Table format
        console.log('\nSystemPrompt OS Status');
        console.log('=====================\n');
        
        console.log('System Information:');
        console.log(`  Version:      ${status.version}`);
        console.log(`  Node Version: ${status.nodeVersion}`);
        console.log(`  Platform:     ${status.platform} (${status.architecture})`);
        console.log(`  Hostname:     ${status.hostname}`);
        console.log(`  Uptime:       ${formatDuration(status.uptime)}`);
        
        console.log('\nResource Usage:');
        console.log(`  CPU:          ${status.cpu.usage}% (${status.cpu.cores} cores)`);
        console.log(`  Memory:       ${formatBytes(status.memory.used)} / ${formatBytes(status.memory.total)} (${status.memory.usagePercent.toFixed(1)}%)`);
        console.log(`  Disk:         ${formatBytes(status.disk.used)} / ${formatBytes(status.disk.total)} (${status.disk.usagePercent.toFixed(1)}%)`);
        
        if (detailed) {
          console.log('\nCPU Details:');
          console.log(`  Model:        ${status.cpu.model}`);
          console.log(`  Load Average: ${status.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}`);
          
          console.log('\nMemory Details:');
          console.log(`  Total:        ${formatBytes(status.memory.total)}`);
          console.log(`  Used:         ${formatBytes(status.memory.used)}`);
          console.log(`  Free:         ${formatBytes(status.memory.free)}`);
        }
        
        console.log('\nModule Status:');
        const moduleTable = status.modules.map(m => ({
          Name: m.name,
          Version: m.version,
          Type: m.type,
          Status: m.status,
          Health: m.healthy ? '✓' : '✗',
          Uptime: m.uptime ? formatDuration(m.uptime) : '-'
        }));
        
        console.table(moduleTable);
      }
    } catch (error) {
      console.error('Error getting system status:', error);
      process.exit(1);
    }
  }
};