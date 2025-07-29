/**
 * Core type definitions and utility functions for the module system.
 * @file Module system type definitions.
 * @module modules/types
 */

export {
  hasResourceExports,
  hasPromptExports,
  hasToolExports,
} from '@/modules/types/module-exports.types';

export type {
  IResourceModuleExports,
  IPromptModuleExports,
  IToolModuleExports,
  IMCPContentModuleExports,
} from '@/modules/types/module-exports.types';

export {
  ModuleName,
  isValidModuleName,
} from '@/modules/types/module-names.types';

// Re-export all loader types
export type {
  IModuleConfig,
  IModulesConfig,
  IModuleService,
  IModuleWithService,
  IModuleInstance,
  IModuleContext,
  IModuleConstructor,
  IModuleExports,
} from '@/modules/types/loader.types';
