#!/usr/bin/env node
/**
 * @fileoverview Monitor status command
 * @module modules/core/monitor/cli
 */

import { getModuleLoader } from '../../../loader.js';

interface MonitorStatus {
  healthy: boolean;
  metrics: {
    total: number;
    active: number;
    rate: number;
  };
  alerts: {
    active: number;
    acknowledged: number;
    resolved_today: number;
  };
  traces: {
    total: number;
    error_rate: number;
    avg_duration: number;
  };
  system: {
    cpu: {
      usage: number;
      cores: number;
      load_average: number[];
    };
    memory: {
      total: number;
      used: number;
      free: number;
      percentage: number;
    };
    uptime: number;
  };
}

export const command = {
  name: 'status',
  description: 'Show overall monitoring status',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      default: 'table',
      choices: ['json', 'yaml', 'table']
    }
  ],
  async execute(context: any) {
    try {
      const moduleLoader = getModuleLoader();
      await moduleLoader.loadModules();
      
      const monitorModule = moduleLoader.getModule('monitor');
      if (!monitorModule?.exports?.MonitorService) {
        throw new Error('Monitor module not available');
      }

      const status: MonitorStatus = await monitorModule.exports.MonitorService.getStatus();

      if (context.options.format === 'json') {
        console.log(JSON.stringify(status, null, 2));
      } else if (context.options.format === 'yaml') {
        // Simple YAML output
        console.log('monitoring_status:');
        console.log(`  healthy: ${status.healthy}`);
        console.log('  metrics:');
        console.log(`    total: ${status.metrics.total}`);
        console.log(`    active: ${status.metrics.active}`);
        console.log(`    rate_per_minute: ${status.metrics.rate}`);
        console.log('  alerts:');
        console.log(`    active: ${status.alerts.active}`);
        console.log(`    acknowledged: ${status.alerts.acknowledged}`);
        console.log(`    resolved_today: ${status.alerts.resolved_today}`);
        console.log('  traces:');
        console.log(`    total: ${status.traces.total}`);
        console.log(`    error_rate: ${status.traces.error_rate}%`);
        console.log(`    avg_duration: ${status.traces.avg_duration}ms`);
        console.log('  system:');
        console.log(`    cpu_usage: ${status.system.cpu.usage}%`);
        console.log(`    memory_usage: ${status.system.memory.percentage.toFixed(1)}%`);
        console.log(`    uptime: ${Math.floor(status.system.uptime / 86400)}d ${Math.floor((status.system.uptime % 86400) / 3600)}h`);
      } else {
        // Table format
        console.log('╔══════════════════════════════════════════╗');
        console.log('║        MONITORING SYSTEM STATUS          ║');
        console.log('╠══════════════════════════════════════════╣');
        console.log(`║ Status: ${status.healthy ? '✓ HEALTHY' : '✗ UNHEALTHY'}                       ║`);
        console.log('╠══════════════════════════════════════════╣');
        console.log('║ METRICS                                  ║');
        console.log(`║   Total: ${status.metrics.total.toString().padEnd(31)}║`);
        console.log(`║   Active: ${status.metrics.active.toString().padEnd(30)}║`);
        console.log(`║   Rate: ${status.metrics.rate}/min                     ║`);
        console.log('╠══════════════════════════════════════════╣');
        console.log('║ ALERTS                                   ║');
        console.log(`║   Active: ${status.alerts.active.toString().padEnd(30)}║`);
        console.log(`║   Acknowledged: ${status.alerts.acknowledged.toString().padEnd(24)}║`);
        console.log(`║   Resolved Today: ${status.alerts.resolved_today.toString().padEnd(22)}║`);
        console.log('╠══════════════════════════════════════════╣');
        console.log('║ TRACES                                   ║');
        console.log(`║   Total: ${status.traces.total.toString().padEnd(31)}║`);
        console.log(`║   Error Rate: ${status.traces.error_rate}%                    ║`);
        console.log(`║   Avg Duration: ${status.traces.avg_duration}ms                ║`);
        console.log('╠══════════════════════════════════════════╣');
        console.log('║ SYSTEM                                   ║');
        console.log(`║   CPU: ${status.system.cpu.usage}% (${status.system.cpu.cores} cores)                 ║`);
        console.log(`║   Memory: ${status.system.memory.percentage.toFixed(1)}%                        ║`);
        console.log(`║   Uptime: ${Math.floor(status.system.uptime / 86400)}d ${Math.floor((status.system.uptime % 86400) / 3600)}h                      ║`);
        console.log('╚══════════════════════════════════════════╝');
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
};