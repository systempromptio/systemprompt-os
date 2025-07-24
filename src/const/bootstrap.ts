/**
 * @file Static bootstrap configuration.
 * @module bootstrap-static
 * Defines the core modules that must be loaded in a specific order
 */

import type { ICoreModuleDefinition } from '@/types/bootstrap.js';

/**
 * Core modules that are essential for system operation
 * These modules are loaded in order and have explicit dependencies.
 */
export const CORE_MODULES: ICoreModuleDefinition[] = [
  {
    name: 'logger',
    path: './build/modules/core/logger/index.js',
    dependencies: [],
    critical: true,
    description: 'System-wide logging service - must be first for debugging',
    type: 'self-contained',
  },
  {
    name: 'database',
    path: './build/modules/core/database/index.js',
    dependencies: ['logger'],
    critical: true,
    description: 'Persistent storage layer for all modules',
    type: 'self-contained',
  },
  {
    name: 'auth',
    path: './build/modules/core/auth/index.js',
    dependencies: ['logger', 'database'],
    critical: true,
    description: 'Authentication, authorization, and JWT management',
    type: 'self-contained',
  },
  {
    name: 'cli',
    path: './build/modules/core/cli/index.js',
    dependencies: ['logger', 'database'],
    critical: true,
    description: 'Command-line interface for system control',
    type: 'self-contained',
  },
  {
    name: 'modules',
    path: './build/modules/core/modules/index.js',
    dependencies: ['logger', 'database'],
    critical: true,
    description: 'Module registry and discovery service',
    type: 'self-contained',
  },
  /*
   * Temporarily disabled - being worked on separately
   * {
   *   name: 'executors',
   *   path: './build/modules/core/executors/index.js',
   *   dependencies: ['logger', 'database'],
   *   critical: false,
   *   description: 'Task executor management system',
   *   type: 'self-contained',
   * },
   */
];

export const MIN_MODULE_NAME_LENGTH = 2;
