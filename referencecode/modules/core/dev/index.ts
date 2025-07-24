import { Service, Inject } from 'typedi';
import type { IModule } from '@/modules/core/modules/types/index.js';
import { ModuleStatus } from '@/modules/core/modules/types/index.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { IDatabaseService } from '@/modules/core/database/types/index.js';
import { TYPES } from '@/modules/core/types.js';
import { DevService } from './services/dev.service.js';

@Service()
export class DevModule implements IModule {
  name = 'dev';
  version = '1.0.0';
  type = 'extension' as const;
  status = ModuleStatus.STOPPED;

  private devService: DevService | null = null;

  constructor(
    @Inject(TYPES.Logger) private readonly logger: ILogger,
    @Inject(TYPES.Database) private readonly db: IDatabaseService,
  ) {}

  async initialize(): Promise<void> {
    this.devService = new DevService(this.logger, this.db);

    this.logger.info('Dev module initialized', { module: this.name });
  }

  async start(): Promise<void> {
    if (!this.devService) {
      throw new Error('Dev module not initialized');
    }

    await this.devService.start();
    this.logger.info('Dev module started', { module: this.name });
  }

  async stop(): Promise<void> {
    if (this.devService) {
      await this.devService.stop();
    }

    this.logger.info('Dev module stopped', { module: this.name });
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      if (!this.devService) {
        return { healthy: false, message: 'Dev service not initialized' };
      }

      const isHealthy = await this.devService.healthCheck();
      return { healthy: isHealthy };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getService(): DevService | null {
    return this.devService;
  }
}

export default DevModule;
