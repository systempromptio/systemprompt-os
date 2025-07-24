#!/usr/bin/env node
/**
 * @fileoverview Export monitoring data command
 * @module modules/core/monitor/cli
 */

import { getModuleLoader } from '@/modules/loader.js';
import * as fs from 'fs';

export const command = {
  name: 'export',
  description: 'Export monitoring data',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Export format',
      default: 'json',
      choices: ['json', 'csv', 'prometheus']
    },
    {
      name: 'output',
      alias: 'o',
      type: 'string',
      description: 'Output file (default: stdout)'
    },
    {
      name: 'start',
      alias: 's',
      type: 'string',
      description: 'Start date (ISO 8601)'
    },
    {
      name: 'end',
      alias: 'e',
      type: 'string',
      description: 'End date (ISO 8601)'
    },
    {
      name: 'metrics',
      alias: 'm',
      type: 'string',
      description: 'Comma-separated list of metrics to export'
    },
    {
      name: 'include-alerts',
      alias: 'a',
      type: 'boolean',
      description: 'Include alerts in export'
    },
    {
      name: 'include-traces',
      alias: 't',
      type: 'boolean',
      description: 'Include traces in export'
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

      // Build export options
      const exportOptions: any = {
        format: context.options.format,
        include_alerts: context.options['include-alerts'],
        include_traces: context.options['include-traces']
      };

      if (context.options.start) {
        exportOptions.start_date = new Date(context.options.start);
      }
      if (context.options.end) {
        exportOptions.end_date = new Date(context.options.end);
      }
      if (context.options.metrics) {
        exportOptions.metrics = context.options.metrics.split(',').map((m: string) => m.trim());
      }

      // Export data
      const exportData = await service.exportData(exportOptions);
      
      // Format output
      let output: string;
      if (context.options.format === 'json') {
        output = JSON.stringify(exportData, null, 2);
      } else if (context.options.format === 'csv' || context.options.format === 'prometheus') {
        // These formats are already string from service
        output = exportData;
      } else {
        output = exportData.toString();
      }

      // Write output
      if (context.options.output) {
        fs.writeFileSync(context.options.output, output);
        console.log(`✓ Data exported to ${context.options.output}`);
      } else {
        console.log(output);
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
};