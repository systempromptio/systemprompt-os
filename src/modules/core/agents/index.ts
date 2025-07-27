/**
 * @file Agents Module for managing agents and tasks.
 * @description Provides agent management and task execution functionality through a modular interface.
 * @module src/modules/core/agents
 */

import { type IModule, ModuleStatusEnum } from '@/modules/core/modules/types/index';
import { AgentService } from '@/modules/core/agents/services/agent.service';
import { AgentRepository } from '@/modules/core/agents/repositories/agent-repository';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { DatabaseServiceAdapter } from '@/modules/core/database/adapters/database-service-adapter';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

/**
 * Strongly typed exports interface for Agents module.
 * Note: Types should typically be defined in types/ folder.
 */
interface IAgentsModuleExports {
  readonly service: () => AgentService;
  readonly repository: () => AgentRepository;
}

/**
 * Agents module provides agent management and task execution functionality.
 */
export class AgentsModule implements IModule<IAgentsModuleExports> {
  public readonly name = 'agents';
  public readonly version = '1.0.0';
  public readonly type = 'service' as const;
  public readonly description = 'Agent management and task execution system';
  public readonly dependencies = ['database', 'logger', 'auth'] as const;
  public status: ModuleStatusEnum = ModuleStatusEnum.STOPPED;
  private agentService!: AgentService;
  private agentRepository!: AgentRepository;
  private logger!: ILogger;
  private database!: DatabaseService;
  private initialized = false;
  private started = false;
  get exports(): IAgentsModuleExports {
    return {
      service: (): AgentService => { return this.agentService },
      repository: (): AgentRepository => { return this.agentRepository }
    };
  }

  /**
   * Initialize the Agents module.
   */
  async initialize(): Promise<void> {
    this.database = DatabaseService.getInstance();
    this.logger = LoggerService.getInstance();
    if (this.initialized) {
      throw new Error('Agents module already initialized');
    }

    try {
      this.logger = LoggerService.getInstance();
      this.database = DatabaseService.getInstance();

      const databaseAdapter = new DatabaseServiceAdapter(this.database);
      this.agentRepository = new AgentRepository(databaseAdapter);
      this.agentService = new AgentService(this.agentRepository, this.logger);

      this.initialized = true;
      this.logger.info(LogSource.MODULES, 'Agents module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize Agents module: ${errorMessage}`);
    }
  }

  /**
   * Start the Agents module.
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
      this.status = ModuleStatusEnum.RUNNING;
      this.started = true;
      this.logger.info(LogSource.MODULES, 'Agents module started');
    } catch (error) {
      this.status = ModuleStatusEnum.STOPPED;
      throw error;
    }
  }

  /**
   * Stop the Agents module.
   */
  async stop(): Promise<void> {
    try {
      if (this.agentService) {
        await this.agentService.stopMonitoring();
      }
      this.status = ModuleStatusEnum.STOPPED;
      this.started = false;
      this.logger.info(LogSource.MODULES, 'Agents module stopped');
    } catch (error) {
      this.logger.error(LogSource.MODULES, 'Failed to stop Agents module', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Health check for the Agents module.
   * @returns Promise resolving to health status object.
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
 * @returns Promise resolving to an initialized AgentsModule instance.
 */
export const initialize = async (): Promise<AgentsModule> => {
  const agentsModule = new AgentsModule();
  await agentsModule.initialize();
  return agentsModule;
};

/**
 * Gets the Agents module with type safety and validation.
 * @returns The Agents module with guaranteed typed exports.
 * @throws {Error} If Agents module is not available or missing required exports.
 */
export function getAgentsModule(): IModule<IAgentsModuleExports> {
  const { getModuleLoader } = require('@/modules/loader');
  const { ModuleName } = require('@/modules/types/index');

  const moduleLoader = getModuleLoader();
  const agentsModule = moduleLoader.getModule(ModuleName.AGENTS);

  if (!agentsModule.exports?.service || typeof agentsModule.exports.service !== 'function') {
    throw new Error('Agents module missing required service export');
  }

  if (!agentsModule.exports?.repository || typeof agentsModule.exports.repository !== 'function') {
    throw new Error('Agents module missing required repository export');
  }

  return agentsModule as IModule<IAgentsModuleExports>;
}

// Export the service and repository classes for direct use
export { AgentService } from '@/modules/core/agents/services/agent.service';
export { AgentRepository } from '@/modules/core/agents/repositories/agent-repository';
export type * from '@/modules/core/agents/types/agent.types';

export default AgentsModule;
