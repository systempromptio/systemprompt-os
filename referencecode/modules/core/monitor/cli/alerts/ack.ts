#!/usr/bin/env node
/**
 * @fileoverview Acknowledge alert command
 * @module modules/core/monitor/cli/alerts
 */

import { getModuleLoader } from '@/modules/loader.js';

export const command = {
  name: 'ack',
  description: 'Acknowledge an alert',
  options: [
    {
      name: 'user',
      alias: 'u',
      type: 'string',
      description: 'User acknowledging the alert',
      required: true
    }
  ],
  positionals: [
    {
      name: 'alertId',
      description: 'Alert ID to acknowledge',
      required: true
    }
  ],
  async execute(context: any) {
    try {
      const alertId = context.positionals.alertId;
      const userId = context.options.user;

      const moduleLoader = getModuleLoader();
      await moduleLoader.loadModules();
      
      const monitorModule = moduleLoader.getModule('monitor');
      if (!monitorModule?.exports?.MonitorService) {
        throw new Error('Monitor module not available');
      }

      await monitorModule.exports.MonitorService.acknowledgeAlert(alertId, userId);
      
      console.log(`✓ Alert ${alertId} acknowledged by ${userId}`);
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
};