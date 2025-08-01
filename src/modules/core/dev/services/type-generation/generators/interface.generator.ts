/**
 * Interface Type Generator Module
 * Generates interface type exports for modules.
 * @module dev/services/type-generation/generators
 */

import { existsSync } from 'fs';
import { join } from 'path';
import type { ILogger } from '@/modules/core/logger/types/manual';
import { LogSource } from '@/modules/core/logger/types/manual';

/**
 * Generates interface type exports.
 */
export class InterfaceGenerator {
  constructor(private readonly logger: ILogger) {}

  /**
   * Generate interface types for a module.
   * @param moduleName - Module name.
   */
  public async generate(moduleName: string): Promise<void> {
    const modulePath = join(process.cwd(), `src/modules/core/${moduleName}`);

    const manualTypesPath = join(modulePath, 'types/manual.ts');
    if (existsSync(manualTypesPath)) {
      this.logger.info(LogSource.DEV, `Found manual types for ${moduleName}, no action needed`);
      return;
    }

    this.logger.debug(LogSource.DEV, `No manual types for ${moduleName}, skipping index.ts generation`);
  }
}
