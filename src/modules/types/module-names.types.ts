/**
 * Enum of all available module names for type-safe access.
 * Ordered alphabetically matching the core modules directory structure.
 */
export enum ModuleName {
  AGENTS = 'agents',
  API = 'api',
  AUTH = 'auth',
  CLI = 'cli',
  CONFIG = 'config',
  DATABASE = 'database',
  DEV = 'dev',
  EVENTS = 'events',
  LOGGER = 'logger',
  MCP = 'mcp',
  MODULES = 'modules',
  MONITOR = 'monitor',
  PERMISSIONS = 'permissions',
  SYSTEM = 'system',
  TASKS = 'tasks',
  USERS = 'users',
  WEBHOOKS = 'webhooks',
}

/**
 * Type representing valid module names.
 */
export type ModuleNameType = `${ModuleName}`;

/**
 * Type guard to check if a string is a valid module name.
 * @param name
 */
export function isValidModuleName(name: string): name is ModuleNameType {
  return Object.values(ModuleName).includes(name as ModuleName);
}
