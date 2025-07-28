/**
 * Static bootstrap configuration.
 * @file Static bootstrap configuration.
 * @module bootstrap-static
 * Defines the core modules that must be loaded in a specific order.
 */

import type { ICoreModuleDefinition } from '@/types/bootstrap';

/**
 * Core modules that are essential for system operation
 * These modules are loaded in order and have explicit dependencies.
 */
export const CORE_MODULES: ICoreModuleDefinition[] = [
  {
    name: 'logger',
    path: './src/modules/core/logger/index.ts',
    dependencies: [],
    critical: true,
    description: 'System-wide logging service - must be first for debugging',
    type: 'self-contained',
  },
  {
    name: 'database',
    path: './src/modules/core/database/index.ts',
    dependencies: ['logger'],
    critical: true,
    description: 'Persistent storage layer for all modules',
    type: 'self-contained',
  },
  {
    name: 'auth',
    path: './src/modules/core/auth/index.ts',
    dependencies: ['logger', 'database'],
    critical: true,
    description: 'Authentication, authorization, and JWT management',
    type: 'self-contained',
  },
  {
    name: 'cli',
    path: './src/modules/core/cli/index.ts',
    dependencies: ['logger', 'database'],
    critical: true,
    description: 'Command-line interface for system control',
    type: 'self-contained',
  },
  {
    name: 'modules',
    path: './src/modules/core/modules/index.ts',
    dependencies: ['logger', 'database'],
    critical: true,
    description: 'Module registry and discovery service',
    type: 'self-contained',
  },
  {
    name: 'config',
    path: './src/modules/core/config/index.ts',
    dependencies: ['logger', 'database'],
    critical: false,
    description: 'Configuration management system',
    type: 'self-contained',
  },
  {
    name: 'permissions',
    path: './src/modules/core/permissions/index.ts',
    dependencies: ['logger', 'database', 'auth'],
    critical: false,
    description: 'Permission and access control system',
    type: 'self-contained',
  },
  {
    name: 'users',
    path: './src/modules/core/users/index.ts',
    dependencies: ['logger', 'database', 'auth'],
    critical: false,
    description: 'User management system',
    type: 'self-contained',
  },
  {
    name: 'events',
    path: './src/modules/core/events/index.ts',
    dependencies: ['logger'],
    critical: false,
    description: 'Event bus for inter-module communication',
    type: 'self-contained',
  },
  {
    name: 'agents',
    path: './src/modules/core/agents/index.ts',
    dependencies: ['logger', 'database', 'auth', 'events'],
    critical: false,
    description: 'Agent management and task execution system',
    type: 'self-contained',
  },
  {
    name: 'system',
    path: './src/modules/core/system/index.ts',
    dependencies: ['logger', 'database'],
    critical: false,
    description: 'System monitoring and management',
    type: 'self-contained',
  },
  {
    name: 'tasks',
    path: './src/modules/core/tasks/index.ts',
    dependencies: ['logger', 'database'],
    critical: false,
    description: 'Task queue and execution system',
    type: 'self-contained',
  },
  {
    name: 'mcp',
    path: './src/modules/core/mcp/index.ts',
    dependencies: ['logger', 'database', 'modules'],
    critical: false,
    description: 'Model Context Protocol integration',
    type: 'self-contained',
  },
  {
    name: 'webhooks',
    path: './src/modules/core/webhooks/index.ts',
    dependencies: ['logger', 'database', 'auth'],
    critical: false,
    description: 'Webhook management system',
    type: 'self-contained',
  },
  {
    name: 'dev',
    path: './src/modules/core/dev/index.ts',
    dependencies: ['logger', 'database'],
    critical: false,
    description: 'Development tools and utilities',
    type: 'self-contained',
  },
];
