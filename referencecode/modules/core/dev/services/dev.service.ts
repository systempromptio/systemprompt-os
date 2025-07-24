import { exec } from 'child_process';
import { promisify } from 'util';
import * as repl from 'repl';
import { watch } from 'chokidar';

const execAsync = promisify(exec);

export class DevService {
  private readonly logger: any;
  private readonly db: any;
  private debugMode: boolean = false;
  private watcher: any = null;
  private replServer: any = null;

  constructor(logger: any, db: any) {
    this.logger = logger;
    this.db = db;
  }

  async start(): Promise<void> {
    this.logger?.info('Dev service started');
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    if (this.replServer) {
      this.replServer.close();
      this.replServer = null;
    }

    this.logger?.info('Dev service stopped');
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async startRepl(context: any = {}): Promise<void> {
    if (this.replServer) {
      throw new Error('REPL already running');
    }

    this.logger?.info('Starting REPL...');

    this.replServer = repl.start({
      prompt: 'systemprompt> ',
      useColors: true,
      useGlobal: true,
    });

    Object.assign(this.replServer.context, {
      db: this.db,
      logger: this.logger,
      ...context,
    });

    this.replServer.on('exit', () => {
      this.replServer = null;
      this.logger?.info('REPL closed');
    });
  }

  async enableDebugMode(): Promise<void> {
    this.debugMode = true;
    process.env['DEBUG'] = 'true';
    process.env['NODE_ENV'] = 'development';

    this.logger?.info('Debug mode enabled');

    if (this.logger?.setLevel) {
      this.logger.setLevel('debug');
    }
  }

  async disableDebugMode(): Promise<void> {
    this.debugMode = false;
    delete process.env['DEBUG'];
    process.env['NODE_ENV'] = 'production';

    this.logger?.info('Debug mode disabled');

    if (this.logger?.setLevel) {
      this.logger.setLevel('info');
    }
  }

  isDebugMode(): boolean {
    return this.debugMode;
  }

  async profilePerformance(duration: number = 10000): Promise<any> {
    this.logger?.info(`Starting performance profiling for ${duration}ms`);

    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();
    const startTime = Date.now();

    await new Promise((resolve) => setTimeout(resolve, duration));

    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(startCpu);
    const endTime = Date.now();

    const profile = {
      duration: endTime - startTime,
      memory: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
        rss: endMemory.rss - startMemory.rss,
      },
      cpu: {
        user: endCpu.user / 1000,
        system: endCpu.system / 1000,
      },
    };

    this.logger?.info('Performance profile completed', profile);
    return profile;
  }

  async runTests(pattern?: string): Promise<{ passed: number; failed: number; total: number }> {
    this.logger?.info('Running tests...', { pattern });

    try {
      const testCommand = pattern ? `npm test -- --testPathPattern="${pattern}"` : 'npm test';

      const { stdout, stderr } = await execAsync(testCommand, {
        cwd: process.cwd(),
      });

      const output = stdout + stderr;
      const passed = (output.match(/✓/g) || []).length;
      const failed = (output.match(/✕/g) || []).length;
      const total = passed + failed;

      this.logger?.info('Tests completed', { passed, failed, total });

      return { passed, failed, total };
    } catch (error) {
      this.logger?.error('Test execution failed', error);
      throw error;
    }
  }

  async runLinter(
    fix: boolean = false,
  ): Promise<{ errors: number; warnings: number; fixed: number }> {
    this.logger?.info('Running linter...', { fix });

    try {
      const lintCommand = fix ? 'npm run lint -- --fix' : 'npm run lint';
      const { stdout, stderr } = await execAsync(lintCommand, {
        cwd: process.cwd(),
      });

      const output = stdout + stderr;
      const errors = parseInt(output.match(/(\d+) errors?/)?.[1] || '0');
      const warnings = parseInt(output.match(/(\d+) warnings?/)?.[1] || '0');
      const fixed = fix ? parseInt(output.match(/(\d+) problems? fixed/)?.[1] || '0') : 0;

      this.logger?.info('Linting completed', { errors, warnings, fixed });

      return { errors, warnings, fixed };
    } catch (error) {
      this.logger?.error('Linting failed', error);
      throw error;
    }
  }

  async formatCode(pattern: string = '**/*.{ts,js,json}'): Promise<{ filesFormatted: number }> {
    this.logger?.info('Formatting code...', { pattern });

    try {
      const { stdout } = await execAsync(`npx prettier --write "${pattern}"`, {
        cwd: process.cwd(),
      });

      const filesFormatted = (stdout.match(/\n/g) || []).length;

      this.logger?.info('Code formatting completed', { filesFormatted });

      return { filesFormatted };
    } catch (error) {
      this.logger?.error('Code formatting failed', error);
      throw error;
    }
  }

  async watchForChanges(pattern: string = 'src/**/*.ts', command?: string): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
    }

    this.logger?.info('Starting file watcher...', { pattern, command });

    this.watcher = watch(pattern, {
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on('change', async (filepath: string) => {
      this.logger?.info('File changed', { filepath });

      if (command) {
        try {
          const { stdout, stderr } = await execAsync(command, {
            cwd: process.cwd(),
            env: { ...process.env, CHANGED_FILE: filepath },
          });

          if (stdout) {this.logger?.info('Command output', { stdout });}
          if (stderr) {this.logger?.warn('Command stderr', { stderr });}
        } catch (error) {
          this.logger?.error('Command execution failed', error);
        }
      }
    });

    this.watcher.on('error', (error: Error) => {
      this.logger?.error('Watcher error', error);
    });
  }

  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.logger?.info('File watcher stopped');
    }
  }
}
