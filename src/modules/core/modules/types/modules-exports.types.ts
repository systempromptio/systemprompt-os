/**
 * Modules module export types.
 */

import type { IModule } from '@/modules/core/modules/types/index';
import type { IModulesRow } from '@/modules/core/modules/types/database.generated';
import type { IModuleScannerService, IScannedModule } from '@/modules/core/modules/types/scanner.types';
import type { ICoreModuleDefinition } from '@/types/bootstrap';
import type { ModuleRegistryService } from '@/modules/core/modules/services/module-registry.service';
import type { ModuleLoaderService } from '@/modules/core/modules/services/module-loader.service';
import type { ModuleManagerService } from '@/modules/core/modules/services/module-manager.service';

/**
 * Strongly typed exports interface for Modules module.
 */
export interface IModulesModuleExports {
  readonly service: () => IModuleScannerService | undefined;
  readonly scanForModules: () => Promise<IScannedModule[]>;
  readonly getEnabledModules: () => Promise<IModulesRow[]>;
  readonly getModule: (name: string) => Promise<IModulesRow | undefined>;
  readonly enableModule: (name: string) => Promise<void>;
  readonly disableModule: (name: string) => Promise<void>;
  readonly registerCoreModule: (
    name: string,
    path: string,
    dependencies?: string[],
  ) => Promise<void>;
  // Core module loading methods
  readonly loadCoreModule: (definition: ICoreModuleDefinition) => Promise<IModule>;
  readonly startCoreModule: (name: string) => Promise<void>;
  readonly getCoreModule: (name: string) => Promise<IModule | undefined>;
  readonly getAllCoreModules: () => Map<string, IModule>;
  readonly registerPreLoadedModule: (name: string, module: IModule) => void;
  // Service access methods
  readonly getRegistry: () => ModuleRegistryService | undefined;
  readonly getLoader: () => ModuleLoaderService | undefined;
  readonly getManager: () => ModuleManagerService | undefined;
  // Database validation method
  readonly validateCoreModules: () => Promise<void>;
}
