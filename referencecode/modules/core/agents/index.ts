/**
 * @fileoverview Agents module for managing autonomous agents
 * @module modules/core/agents
 */

import { Service, Inject } from 'typedi';
import type { IModule } from '@/modules/core/modules/types/index.js';
import { ModuleStatus } from '@/modules/core/modules/types/index.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { IDatabaseService } from '@/modules/core/database/types/index.js';
import { TYPES } from '@/modules/core/types.js';
import { AgentService } from './services/agent-service.js';
import { AgentRepository } from './repositories/agent-repository.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

@Service()
export class AgentsModule implements IModule {
  name = 'agents';
  version = '1.0.0';
  type = 'service' as const;
  status = ModuleStatus.STOPPED;
  dependencies = ['database', 'logger', 'auth'];

  private agentService!: AgentService;
  private agentRepository!: AgentRepository;

  constructor(
    @Inject(TYPES.Logger) private readonly logger: ILogger,
    @Inject(TYPES.Database) private readonly db: IDatabaseService,
  ) {}

  async initialize(): Promise<void> {
    try {
      // Initialize schema
      await this.initializeDatabase();

      // Initialize repository and service
      this.agentRepository = new AgentRepository(this.logger);
      this.agentService = new AgentService(this.agentRepository, this.logger);

      this.logger.info('Agents module initialized', { module: this.name });
    } catch (error) {
      this.logger.error('Failed to initialize agents module', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      // Start monitoring
      await this.agentService.startMonitoring();
      this.logger.info('Agents module started', { module: this.name });
    } catch (error) {
      this.logger.error('Failed to start agents module', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      // Stop monitoring and cleanup
      await this.agentService.stopMonitoring();
      this.logger.info('Agents module stopped', { module: this.name });
    } catch (error) {
      this.logger.error('Error stopping agents module', error);
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Check database connection
      // Check if we can query the database
      const dbHealthy = await this.db
        .get('SELECT 1 as healthy')
        .then(() => true)
        .catch(() => false);

      // Check service health
      const serviceHealthy = this.agentService.isHealthy();

      const healthy = dbHealthy && serviceHealthy;

      return {
        healthy,
        message: healthy ? 'Agents module is healthy' : 'Agents module health check failed',
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // API methods

  async createAgent(data: any): Promise<any> {
    return this.agentService.createAgent(data);
  }

  async startAgent(id: string): Promise<void> {
    return this.agentService.startAgent(id);
  }

  async stopAgent(id: string, force?: boolean): Promise<void> {
    return this.agentService.stopAgent(id, force);
  }

  async getAgentStatus(id: string): Promise<any> {
    return this.agentService.getAgentStatus(id);
  }

  async listAgents(filter?: any): Promise<any[]> {
    return this.agentService.listAgents(filter);
  }

  async assignTask(data: any): Promise<any> {
    return this.agentService.assignTask(data);
  }

  // CLI command

  async getCommand(): Promise<any> {
    const { Command } = await import('commander');
    const listCmd = await import('./cli/list.js');
    const createCmd = await import('./cli/create.js');
    const startCmd = await import('./cli/start.js');
    const stopCmd = await import('./cli/stop.js');
    const statusCmd = await import('./cli/status.js');
    const logsCmd = await import('./cli/logs.js');
    const configCmd = await import('./cli/config.js');
    const assignCmd = await import('./cli/assign.js');

    const cmd = new Command('agents').description('Agent management commands');

    // Add commands using the command definitions
    const commands = [
      { name: 'list', command: listCmd.command },
      { name: 'create', command: createCmd.command },
      { name: 'start', command: startCmd.command },
      { name: 'stop', command: stopCmd.command },
      { name: 'status', command: statusCmd.command },
      { name: 'logs', command: logsCmd.command },
      { name: 'config', command: configCmd.command },
      { name: 'assign', command: assignCmd.command },
    ];

    // Register each command
    commands.forEach(({ name, command }) => {
      if (command) {
        const subCmd = new Command(name).description(command.description || `${name} agent`);

        // Add options if defined
        if (command.options && typeof command.options === 'object') {
          Object.entries(command.options).forEach(([key, value]: [string, any]) => {
            if (value.short) {
              subCmd.option(`-${value.short}, --${key}`, value.description);
            } else {
              subCmd.option(`--${key}`, value.description);
            }
          });
        }

        // Add arguments if defined
        if ('arguments' in command && command.arguments && Array.isArray(command.arguments)) {
          (command.arguments).forEach((arg: any) => {
            if (arg.required) {
              subCmd.argument(`<${arg.name}>`, arg.description);
            } else {
              subCmd.argument(`[${arg.name}]`, arg.description);
            }
          });
        }

        // Set action handler
        subCmd.action(async (...args) => {
          const options = args[args.length - 1];
          const context = {
            cwd: process.cwd(),
            args: {},
            options,
            module: this,
          };

          // Map positional arguments
          if ('arguments' in command && command.arguments && Array.isArray(command.arguments)) {
            (command.arguments).forEach((arg: any, index: number) => {
              (context.args as any)[arg.name] = args[index];
            });
          }

          await command.execute(context);
        });

        cmd.addCommand(subCmd);
      }
    });

    return cmd;
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Read and execute schema
      const schemaPath = join(__dirname, 'database', 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      const statements = schema.split(';').filter((s) => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          await this.db.exec(statement);
        }
      }

      this.logger.info('Agents database schema initialized');
    } catch (error) {
      this.logger.error('Failed to initialize agents database', error);
      throw error;
    }
  }
}

// Export for dynamic loading
export default AgentsModule;
