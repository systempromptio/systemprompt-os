#!/usr/bin/env node
/**
 * @fileoverview Configure alerts command
 * @module modules/core/monitor/cli/alerts
 */

import { getModuleLoader } from '@/modules/loader.js';
import { randomUUID } from 'crypto';

export const command = {
  name: 'config',
  description: 'Configure alert rules',
  options: [
    {
      name: 'list',
      alias: 'l',
      type: 'boolean',
      description: 'List configured alerts'
    },
    {
      name: 'create',
      alias: 'c',
      type: 'boolean',
      description: 'Create new alert config'
    },
    {
      name: 'update',
      alias: 'u',
      type: 'string',
      description: 'Update alert config by ID'
    },
    {
      name: 'name',
      type: 'string',
      description: 'Alert name'
    },
    {
      name: 'metric',
      type: 'string',
      description: 'Metric to monitor'
    },
    {
      name: 'operator',
      type: 'string',
      description: 'Comparison operator',
      choices: ['>', '<', '>=', '<=', '==', '!=']
    },
    {
      name: 'threshold',
      type: 'number',
      description: 'Alert threshold'
    },
    {
      name: 'severity',
      type: 'string',
      description: 'Alert severity',
      choices: ['critical', 'warning', 'info']
    },
    {
      name: 'enabled',
      type: 'boolean',
      description: 'Enable/disable alert'
    },
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

      const service = monitorModule.exports.MonitorService;

      if (context.options.list) {
        // List alert configs
        const configs = await service.getAlertConfigs();
        
        if (context.options.format === 'json') {
          console.log(JSON.stringify(configs, null, 2));
        } else if (context.options.format === 'yaml') {
          console.log('alert_configs:');
          configs.forEach((config: any) => {
            console.log(`  - id: ${config.id}`);
            console.log(`    name: ${config.name}`);
            console.log(`    severity: ${config.severity}`);
            console.log(`    metric: ${config.condition.metric}`);
            console.log(`    operator: ${config.condition.operator}`);
            console.log(`    threshold: ${config.condition.threshold}`);
            console.log(`    enabled: ${config.enabled}`);
          });
        } else {
          if (configs.length === 0) {
            console.log('No alert configurations found');
            return;
          }

          console.log('Alert Configurations:\n');
          console.log('ID                                    | Name                | Severity | Condition                    | Enabled');
          console.log('--------------------------------------|---------------------|----------|------------------------------|--------');
          
          configs.forEach((config: any) => {
            const id = config.id.substring(0, 36);
            const name = config.name.substring(0, 19).padEnd(19);
            const severity = config.severity.padEnd(8);
            const condition = `${config.condition.metric} ${config.condition.operator} ${config.condition.threshold}`;
            const conditionStr = condition.substring(0, 28).padEnd(28);
            const enabled = config.enabled ? 'Yes' : 'No';
            
            console.log(`${id} | ${name} | ${severity} | ${conditionStr} | ${enabled}`);
          });
        }
      } else if (context.options.create) {
        // Create new alert config
        if (!context.options.name || !context.options.metric || 
            !context.options.operator || context.options.threshold === undefined ||
            !context.options.severity) {
          throw new Error('Missing required parameters: --name, --metric, --operator, --threshold, --severity');
        }

        const config = {
          id: randomUUID(),
          name: context.options.name,
          condition: {
            metric: context.options.metric,
            operator: context.options.operator,
            threshold: context.options.threshold
          },
          severity: context.options.severity,
          channels: [], // TODO: Add channel configuration
          enabled: context.options.enabled !== false,
          created_at: new Date(),
          updated_at: new Date()
        };

        await service.configureAlert(config);
        console.log(`✓ Alert configuration created: ${config.id}`);
      } else if (context.options.update) {
        // Update existing alert config
        const updates: any = {};
        
        if (context.options.name !== undefined) {updates.name = context.options.name;}
        if (context.options.severity !== undefined) {updates.severity = context.options.severity;}
        if (context.options.enabled !== undefined) {updates.enabled = context.options.enabled;}
        
        if (context.options.metric || context.options.operator || context.options.threshold !== undefined) {
          updates.condition = {
            metric: context.options.metric,
            operator: context.options.operator,
            threshold: context.options.threshold
          };
        }

        await service.updateAlertConfig(context.options.update, updates);
        console.log(`✓ Alert configuration updated: ${context.options.update}`);
      } else {
        console.log('Please specify --list, --create, or --update');
        process.exit(1);
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
};