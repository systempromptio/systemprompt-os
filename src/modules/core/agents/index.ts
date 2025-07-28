/**
 * Agents Module for managing agents and tasks.
 * Provides agent management and task execution functionality through
 * a modular interface.
 * @file Agents Module for managing agents and tasks.
 * @module src/modules/core/agents
 */

import {
 type IModule, ModuleStatusEnum, ModuleTypeEnum
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
  public readonly type = ModuleTypeEnum.CORE;
  public readonly description = 'Agent management and task execution system';
  public readonly dependencies = ['database', 'logger', 'auth', 'events'] as const;
  public status: ModuleStatusEnum = ModuleStatusEnum.STOPPED;
  private agentService!: AgentService;
  private agentRepository!: AgentRepository;
  private logger!: ILogger;
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
   * @throws {Error} If initialization fails or module already initialized.
   */
  async initialize(): Promise<void> {
    this.logger = LoggerService.getInstance();
    if (this.initialized) {
      throw new Error('Agents module already initialized');
    }

    try {
      this.logger = LoggerService.getInstance();
      this.agentRepository = AgentRepository.getInstance();
      this.agentService = AgentService.getInstance();

      this.initialized = true;
      this.logger.info(LogSource.MODULES, 'Agents module initialized');
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
   * @throws {Error} If stopping the module fails.
   */
  async stop(): Promise<void> {
    try {
      await this.agentService.stopMonitoring();
      this.status = ModuleStatusEnum.STOPPED;
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
export const initialize = (): AgentsModule => {
  const agentsModule = new AgentsModule();
  agentsModule.initialize();
  return agentsModule;
};

/**
 * Gets the Agents module with type safety and validation.
 * @returns The Agents module with guaranteed typed exports.
 */
export const getAgentsModule = (): IModule<IAgentsModuleExports> => {
  return {
    name: 'agents',
    type: 'core',
    version: '1.0.0',
    dependencies: ['logger', 'database'],
    status: ModuleStatusEnum.RUNNING,
    exports: {
      service: () => AgentService.getInstance(),
      repository: () => AgentRepository.getInstance()
    },
    initialize: async () => { await Promise.resolve(); },
    start: async () => { await Promise.resolve(); },
    stop: async () => { await Promise.resolve(); },
    healthCheck: async () => {
      try {
        await AgentService.getInstance().listAgents();
        return { healthy: true, message: 'Agents module is healthy' };
      } catch (error) {
        return { healthy: false, message: `Unhealthy: ${error instanceof Error ? error.message : 'Unknown error'}` };
      }
    }
  };
};

export default AgentsModule;
