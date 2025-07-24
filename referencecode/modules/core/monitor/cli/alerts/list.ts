#!/usr/bin/env node
/**
 * @fileoverview List active alerts command
 * @module modules/core/monitor/cli/alerts
 */

import { getModuleLoader } from '@/modules/loader.js';

export const command = {
  name: 'list',
  description: 'List active alerts',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      default: 'table',
      choices: ['json', 'yaml', 'table']
    },
    {
      name: 'severity',
      alias: 's',
      type: 'string',
      description: 'Filter by severity',
      choices: ['critical', 'warning', 'info']
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

      const alerts = await monitorModule.exports.MonitorService.getActiveAlerts();
      
      // Filter by severity if specified
      const filteredAlerts = context.options.severity
        ? alerts.filter((a: any) => a.severity === context.options.severity)
        : alerts;

      if (context.options.format === 'json') {
        console.log(JSON.stringify(filteredAlerts, null, 2));
      } else if (context.options.format === 'yaml') {
        console.log('alerts:');
        filteredAlerts.forEach((alert: any) => {
          console.log(`  - id: ${alert.id}`);
          console.log(`    name: ${alert.name}`);
          console.log(`    severity: ${alert.severity}`);
          console.log(`    status: ${alert.status}`);
          console.log(`    message: ${alert.message}`);
          console.log(`    created_at: ${alert.created_at}`);
          if (alert.acknowledged_at) {
            console.log(`    acknowledged_at: ${alert.acknowledged_at}`);
            console.log(`    acknowledged_by: ${alert.acknowledged_by}`);
          }
        });
      } else {
        // Table format
        if (filteredAlerts.length === 0) {
          console.log('No active alerts');
          return;
        }

        console.log('Active Alerts:\n');
        console.log('ID                                    | Severity | Status       | Name                     | Created');
        console.log('--------------------------------------|----------|--------------|--------------------------|-------------------------');
        
        filteredAlerts.forEach((alert: any) => {
          const id = alert.id.substring(0, 36);
          const severity = alert.severity.padEnd(8);
          const status = alert.status.padEnd(12);
          const name = alert.name.substring(0, 24).padEnd(24);
          const created = new Date(alert.created_at).toLocaleString();
          
          console.log(`${id} | ${severity} | ${status} | ${name} | ${created}`);
        });

        console.log(`\nTotal: ${filteredAlerts.length} alert(s)`);
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
};