/**
 * @file Module system type definitions.
 * @module modules/types
 */

export type {
  IModuleConfig,
  IModulesConfig,
  IModuleScannerService,
  IModuleService,
  IModuleWithService,
  IModuleInstance,
  IModuleContext,
  IModuleConstructor,
  IModuleExports,
} from '@/modules/types/loader.types';

export type {
  IResourceModuleExports,
  IPromptModuleExports,
  IToolModuleExports,
  IMCPContentModuleExports,
} from '@/modules/types/module-exports.types';

export {
  hasResourceExports,
  hasPromptExports,
  hasToolExports,
} from '@/modules/types/module-exports.types';

export {
  ModuleName,
  type ModuleNameType,
  isValidModuleName,
} from '@/modules/types/module-names.types';
