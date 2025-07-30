/**
 * Helper utilities for getting services from module registry.
 */

import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { EventBusService } from '@/modules/core/events/services/event-bus.service';
import type { LoggerService } from '@/modules/core/logger/services/logger.service';

/**
 * Get database service from registry or singleton.
 * @returns Database service instance.
 */
export function getDatabaseService(): DatabaseService | null {
  try {
    // Try module registry first
    const { getModuleRegistry } = require('@/modules/loader');
    const { ModuleName } = require('@/modules/types/index');
    
    const registry = getModuleRegistry();
    const databaseModule = registry.get(ModuleName.DATABASE);
    
    if (databaseModule?.exports?.service) {
      return databaseModule.exports.service();
    }
  } catch (error) {
    // Registry not available
  }
  
  // Don't fallback to getInstance to avoid initialization errors
  return null;
}

/**
 * Get event bus service from registry or singleton.
 * @returns Event bus service instance.
 */
export function getEventBusService(): EventBusService | null {
  try {
    // Try module registry first
    const { getModuleRegistry } = require('@/modules/loader');
    const { ModuleName } = require('@/modules/types/index');
    
    const registry = getModuleRegistry();
    const eventsModule = registry.get(ModuleName.EVENTS);
    
    if (eventsModule?.exports?.eventBus) {
      return eventsModule.exports.eventBus();
    }
  } catch (error) {
    // Registry not available
  }
  
  // Don't fallback to getInstance to avoid initialization errors
  return null;
}

/**
 * Get logger service from registry or singleton.
 * @returns Logger service instance.
 */
export function getLoggerService(): LoggerService | null {
  try {
    // Try module registry first
    const { getModuleRegistry } = require('@/modules/loader');
    const { ModuleName } = require('@/modules/types/index');
    
    const registry = getModuleRegistry();
    const loggerModule = registry.get(ModuleName.LOGGER);
    
    if (loggerModule?.exports?.service) {
      return loggerModule.exports.service();
    }
  } catch (error) {
    // Registry not available
  }
  
  // Don't fallback to getInstance to avoid initialization errors
  return null;
}