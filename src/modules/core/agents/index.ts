/**
 * Agents Module for managing agents and tasks.
 * Provides agent management and task execution functionality through
 * a modular interface.
 * @file Agents Module for managing agents and tasks.
 * @module src/modules/core/agents
 */

import {
 type IModule, ModulesStatus, ModulesType
} from '@/modules/core/modules/types/index';
import { AgentService } from '@/modules/core/agents/services/agent.service';
import { AgentRepository } from '@/modules/core/agents/repositories/agent.repository';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { type IAgentsModuleExports } from '@/modules/core/agents/types/index';
/**
 * Agents module provides agent management and task execution functionality.
 */
export class AgentsModule implements IModule<IAgentsModuleExports> {
  public readonly name = 'agents';
  public readonly version = '1.0.0';
  public readonly type = ModulesType.CORE;
  public readonly description = 'Agent management and task execution system';
  public readonly dependencies = ['database', 'logger', 'auth', 'events'] as const;
  public status: ModulesStatus = ModulesStatus.PENDING;
  private agentService!: AgentService;
  private agentRepository!: AgentRepository;
  private logger!: ILogger;
  private initialized = false;
  private started = false;
  get exports(): IAgentsModuleExports {
    return {
      service: (): AgentService => {
        return this.agentService;
      },
      repository: (): AgentRepository => {
        return this.agentRepository;
      }
    };
  }

  /**
   * Initialize the Agents module.
   * @throws {Error} If initialization fails or module already initialized.
   */
  async initialize(): Promise<void> {
    this.logger = LoggerService.getInstance();

    if (this.initialized) {
      throw new Error('Agents module already initialized');
    }

    try {
      this.agentRepository = AgentRepository.getInstance();
      this.agentService = AgentService.getInstance();

      this.initialized = true;
      this.logger.info(LogSource.MODULES, 'Agents module initialized');
      await Promise.resolve();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize Agents module: ${errorMessage}`);
    }
  }

  /**
   * Start the Agents module.
   * @throws {Error} If the module is not initialized or fails to start.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Agents module not initialized');
    }

    if (this.started) {
      return;
    }

    try {
      await this.agentService.startMonitoring();
      [this.status] = [ModulesStatus.RUNNING];
      this.started = true;
      this.logger.info(LogSource.MODULES, 'Agents module started');
    } catch (error) {
      [this.status] = [ModulesStatus.STOPPED];
      throw error;
    }
  }

  /**
   * Stop the Agents module.
   * @throws {Error} If stopping the module fails.
   */
  async stop(): Promise<void> {
    try {
      await this.agentService.stopMonitoring();
      [this.status] = [ModulesStatus.STOPPED];
      this.started = false;
      this.logger.info(LogSource.MODULES, 'Agents module stopped');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        LogSource.MODULES,
        'Failed to stop Agents module',
        { error: errorMessage }
      );
      throw error;
    }
  }

  /**
   * Health check for the Agents module.
   * @returns Health status object with healthy boolean and optional message.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      if (!this.initialized) {
        return {
          healthy: false,
          message: 'Agents module not initialized'
        };
      }

      if (!this.started) {
        return {
          healthy: false,
          message: 'Agents module not started'
        };
      }

      await Promise.resolve();
      return {
        healthy: true,
        message: 'Agents module is healthy'
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Agents module unhealthy: ${String(error)}`
      };
    }
  }
}

/**
 * Create a new AgentsModule instance.
 * @returns A new AgentsModule instance.
 */
export const createModule = (): AgentsModule => {
  return new AgentsModule();
};

/**
 * Create and initialize a new AgentsModule instance.
 * @returns An initialized AgentsModule instance.
 */
export const initialize = async (): Promise<AgentsModule> => {
  const agentsModule = new AgentsModule();
  await agentsModule.initialize();
  return agentsModule;
};

/**
 * Gets the Agents module with type safety and validation.
 * This should only be used after bootstrap when the module loader is available.
 * @returns The Agents module with guaranteed typed exports.
 * @throws {Error} If Agents module is not available or missing required exports.
 */
export function getAgentsModule(): IModule<IAgentsModuleExports> {
  const { getModuleRegistry } = require('@/modules/loader');
  const { ModuleName } = require('@/modules/types/module-names.types');

  const registry = getModuleRegistry();
  const agentsModule = registry.get(ModuleName.AGENTS);

  if (!agentsModule.exports?.service || typeof agentsModule.exports.service !== 'function') {
    throw new Error('Agents module missing required service export');
  }

  if (!agentsModule.exports?.repository || typeof agentsModule.exports.repository !== 'function') {
    throw new Error('Agents module missing required repository export');
  }

  return agentsModule as IModule<IAgentsModuleExports>;
}

export default AgentsModule;
