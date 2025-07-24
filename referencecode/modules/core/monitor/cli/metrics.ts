#!/usr/bin/env node
/**
 * @fileoverview View metrics command
 * @module modules/core/monitor/cli
 */

import { getModuleLoader } from '@/modules/loader.js';

export const command = {
  name: 'metrics',
  description: 'View and query metrics',
  options: [
    {
      name: 'metric',
      alias: 'm',
      type: 'string',
      description: 'Metric name to query'
    },
    {
      name: 'list',
      alias: 'l',
      type: 'boolean',
      description: 'List available metric names'
    },
    {
      name: 'start',
      alias: 's',
      type: 'string',
      description: 'Start time (ISO 8601 or relative like -1h)'
    },
    {
      name: 'end',
      alias: 'e',
      type: 'string',
      description: 'End time (ISO 8601 or relative like now)'
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      default: 'table',
      choices: ['json', 'yaml', 'table', 'csv']
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

      const service = monitorModule.exports.MonitorService;

      if (context.options.list) {
        // List available metrics
        const metricNames = await service.getMetricNames();
        
        if (context.options.format === 'json') {
          console.log(JSON.stringify(metricNames, null, 2));
        } else if (context.options.format === 'yaml') {
          console.log('metrics:');
          metricNames.forEach((name: string) => {
            console.log(`  - ${name}`);
          });
        } else {
          console.log('Available Metrics:');
          metricNames.forEach((name: string) => {
            console.log(`  • ${name}`);
          });
          console.log(`\nTotal: ${metricNames.length} metric(s)`);
        }
      } else if (context.options.metric) {
        // Query specific metric
        const query: any = {
          metric: context.options.metric
        };

        // Parse time ranges
        if (context.options.start) {
          query.start_time = parseTime(context.options.start);
        }
        if (context.options.end) {
          query.end_time = parseTime(context.options.end);
        }

        const result = await service.queryMetrics(query);

        if (context.options.format === 'json') {
          console.log(JSON.stringify(result, null, 2));
        } else if (context.options.format === 'yaml') {
          console.log(`metric: ${result.metric}`);
          console.log('data:');
          result.data.forEach((point: any) => {
            console.log(`  - timestamp: ${point.timestamp}`);
            console.log(`    value: ${point.value}`);
          });
        } else if (context.options.format === 'csv') {
          console.log('timestamp,value');
          result.data.forEach((point: any) => {
            console.log(`${point.timestamp},${point.value}`);
          });
        } else {
          // Table format
          console.log(`Metric: ${result.metric}`);
          console.log(`Data Points: ${result.data.length}\n`);
          
          if (result.data.length > 0) {
            console.log('Timestamp                 | Value');
            console.log('--------------------------|----------------');
            
            // Show last 20 points in table
            const points = result.data.slice(-20);
            points.forEach((point: any) => {
              const timestamp = new Date(point.timestamp).toLocaleString();
              const value = point.value.toFixed(2).padStart(14);
              console.log(`${timestamp} | ${value}`);
            });

            if (result.data.length > 20) {
              console.log(`\n... showing last 20 of ${result.data.length} data points`);
            }
          }
        }
      } else {
        console.log('Please specify --list or --metric <name>');
        process.exit(1);
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
};

function parseTime(timeStr: string): Date {
  // Handle relative times
  if (timeStr.startsWith('-')) {
    const match = timeStr.match(/^-(\d+)([smhd])$/);
    if (match) {
      const value = parseInt(match[1]) || 0;
      const unit = match[2];
      const now = new Date();
      
      switch (unit) {
        case 's':
          return new Date(now.getTime() - value * 1000);
        case 'm':
          return new Date(now.getTime() - value * 60 * 1000);
        case 'h':
          return new Date(now.getTime() - value * 60 * 60 * 1000);
        case 'd':
          return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
      }
    }
  }
  
  if (timeStr === 'now') {
    return new Date();
  }
  
  // Parse as ISO 8601
  return new Date(timeStr);
}