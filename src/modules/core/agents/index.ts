/**
 * Agents module - Auto-generated type-safe implementation.
 * @file Agents module entry point with full Zod validation.
 * @module modules/core/agents
 */

import { BaseModule, ModulesType } from '@/modules/core/modules/types/manual';
import { AgentsService } from '@/modules/core/agents/services/agents.service';
import {
  AgentsModuleExportsSchema,
  AgentsServiceSchema,
  type IAgentsModuleExports
} from '@/modules/core/agents/types/agents.service.generated';
import type { ZodSchema } from 'zod';

/**
 * Agents module implementation using BaseModule.
 * Provides agents management services with full Zod validation.
 */
export class AgentsModule extends BaseModule<IAgentsModuleExports> {
  public readonly name = 'agents' as const;
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Agents management system';
  public readonly dependencies = ['logger', 'database', 'events'] as const;
  private agentsService!: AgentsService;
  get exports(): IAgentsModuleExports {
    return {
      service: (): AgentsService => {
        this.ensureInitialized();
        return this.validateServiceStructure(
          this.agentsService,
          AgentsServiceSchema,
          'AgentsService'
        );
      },
    };
  }

  /**
   * Get the Zod schema for this module's exports.
   * @returns The Zod schema for validating module exports.
   */
  protected getExportsSchema(): ZodSchema {
    return AgentsModuleExportsSchema;
  }

  /**
   * Initialize the module.
   */
  protected async initializeModule(): Promise<void> {
    this.agentsService = AgentsService.getInstance();

    await this.agentsService.initialize();
  }
}

/**
 * Create and return a new agents module instance.
 * @returns A new agents module instance.
 */
export const createModule = (): AgentsModule => {
  return new AgentsModule();
};

/**
 * Export module instance.
 */
export const agentsModule = new AgentsModule();

/**
 * Initialize the agents module.
 * @returns Promise that resolves when the module is initialized.
 */
export const initialize = async (): Promise<void> => {
  await agentsModule.initialize();
};
