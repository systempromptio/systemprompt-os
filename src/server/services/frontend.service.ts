/**
 * Frontend Service for SystemPrompt OS.
 * Manages the integrated frontend system with Vite for development.
 */

import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { EventBus } from '../core/services/event-bus.service';
import { ServerEvents } from '../core/types/events.types';
import { LoggerService } from '../../modules/core/logger/services/logger.service';
import { LogSource } from '../../modules/core/logger/types/manual';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface FrontendConfig {
  enabled: boolean;
  mode: 'development' | 'production';
  vitePort: number;
  buildPath: string;
  sourcePath: string;
}

export class FrontendService {
  private static instance: FrontendService;
  private viteProcess: ChildProcess | null = null;
  private logger = LoggerService.getInstance();
  private config: FrontendConfig;
  private eventBus?: EventBus;

  private constructor() {
    this.config = {
      enabled: true,
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      vitePort: 5173,
      buildPath: resolve(__dirname, '../../../dist/server/frontend'),
      sourcePath: resolve(__dirname, '../frontend')
    };
  }

  public static getInstance(): FrontendService {
    if (!FrontendService.instance) {
      FrontendService.instance = new FrontendService();
    }
    return FrontendService.instance;
  }

  /**
   * Initialize the frontend service with event bus.
   */
  public initialize(eventBus: EventBus): void {
    this.eventBus = eventBus;
    
    // Register for frontend-related events
    this.registerEventHandlers();
    
    this.logger.info(LogSource.SERVER, 'Frontend service initialized', {
      mode: this.config.mode,
      enabled: this.config.enabled
    });
  }

  /**
   * Start the frontend service.
   */
  public async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info(LogSource.SERVER, 'Frontend service disabled');
      return;
    }

    if (this.config.mode === 'development') {
      await this.startViteDevServer();
    } else {
      await this.verifyProductionBuild();
    }

    // Emit event that frontend is ready
    this.eventBus?.emit(ServerEvents.SERVICE_REGISTERED, {
      name: 'frontend',
      service: {
        mode: this.config.mode,
        url: this.getFrontendUrl()
      }
    });
  }

  /**
   * Start Vite development server.
   */
  private async startViteDevServer(): Promise<void> {
    if (this.viteProcess) {
      this.logger.warn(LogSource.SERVER, 'Vite dev server already running');
      return;
    }

    try {
      this.logger.info(LogSource.SERVER, `Starting Vite dev server on port ${this.config.vitePort}`);
      
      // Check if frontend source exists
      if (!existsSync(this.config.sourcePath)) {
        this.logger.error(LogSource.SERVER, 'Frontend source directory not found', {
          path: this.config.sourcePath
        });
        return;
      }

      // Spawn Vite process
      this.viteProcess = spawn('npx', ['vite', '--port', String(this.config.vitePort)], {
        cwd: this.config.sourcePath,
        stdio: 'pipe',
        shell: true,
        env: {
          ...process.env,
          NODE_ENV: 'development'
        }
      });

      // Handle stdout
      this.viteProcess.stdout?.on('data', (data) => {
        const message = data.toString().trim();
        if (message && !message.includes('node_modules')) {
          this.logger.debug(LogSource.SERVER, `[Vite] ${message}`);
        }
      });

      // Handle stderr
      this.viteProcess.stderr?.on('data', (data) => {
        const message = data.toString().trim();
        if (message && !message.includes('warning')) {
          this.logger.warn(LogSource.SERVER, `[Vite Error] ${message}`);
        }
      });

      // Handle process exit
      this.viteProcess.on('exit', (code) => {
        this.logger.info(LogSource.SERVER, `Vite dev server exited with code ${code}`);
        this.viteProcess = null;
        
        // Emit event that frontend stopped
        this.eventBus?.emit(ServerEvents.SERVICE_UNREGISTERED, {
          name: 'frontend',
          service: { code }
        });
      });

      // Handle process error
      this.viteProcess.on('error', (error) => {
        this.logger.error(LogSource.SERVER, 'Failed to start Vite dev server', { error });
        this.viteProcess = null;
      });

      // Wait for Vite to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.logger.info(LogSource.SERVER, `✨ Frontend dev server running at http://localhost:${this.config.vitePort}`);
      this.logger.info(LogSource.SERVER, '🔥 Hot Module Replacement enabled');
    } catch (error) {
      this.logger.error(LogSource.SERVER, 'Failed to start Vite dev server', {
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }

  /**
   * Verify production build exists.
   */
  private async verifyProductionBuild(): Promise<void> {
    if (!existsSync(this.config.buildPath)) {
      this.logger.warn(LogSource.SERVER, 'Frontend production build not found', {
        path: this.config.buildPath
      });
      this.logger.info(LogSource.SERVER, 'Run "npm run build:frontend" to build the frontend');
    } else {
      this.logger.info(LogSource.SERVER, '✅ Frontend production build found');
    }
  }

  /**
   * Register event handlers for frontend-related events.
   */
  private registerEventHandlers(): void {
    if (!this.eventBus) return;

    // Handle module UI registration requests
    this.eventBus.on('FRONTEND.REGISTER_MODULE_UI', (event) => {
      this.logger.info(LogSource.SERVER, 'Module UI registration received', {
        moduleId: event.moduleId,
        components: event.components?.length || 0,
        pages: event.pages?.length || 0
      });

      // Forward to frontend via WebSocket or SSE
      this.broadcastToFrontend('module:registerUI', event);
    });

    // Handle theme change requests
    this.eventBus.on('FRONTEND.CHANGE_THEME', (event) => {
      this.logger.info(LogSource.SERVER, 'Theme change requested', {
        theme: event.theme
      });

      this.broadcastToFrontend('theme:change', event);
    });
  }

  /**
   * Broadcast event to frontend clients.
   */
  private broadcastToFrontend(eventType: string, data: any): void {
    // This would be implemented with WebSocket or SSE
    // For now, we'll emit a server event that the HTTP handler can pick up
    this.eventBus?.emit('FRONTEND.BROADCAST', {
      type: eventType,
      data
    });
  }

  /**
   * Stop the frontend service.
   */
  public async stop(): Promise<void> {
    if (!this.viteProcess) {
      return;
    }

    this.logger.info(LogSource.SERVER, 'Stopping frontend service');
    
    return new Promise((resolve) => {
      if (!this.viteProcess) {
        resolve();
        return;
      }

      this.viteProcess.on('exit', () => {
        this.viteProcess = null;
        resolve();
      });

      this.viteProcess.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.viteProcess) {
          this.viteProcess.kill('SIGKILL');
          this.viteProcess = null;
        }
        resolve();
      }, 5000);
    });
  }

  /**
   * Check if frontend service is running.
   */
  public isRunning(): boolean {
    if (this.config.mode === 'development') {
      return this.viteProcess !== null && !this.viteProcess.killed;
    }
    return existsSync(this.config.buildPath);
  }

  /**
   * Get frontend URL based on mode.
   */
  public getFrontendUrl(): string {
    if (this.config.mode === 'development') {
      return `http://localhost:${this.config.vitePort}`;
    }
    return '/';
  }

  /**
   * Get frontend configuration.
   */
  public getConfig(): FrontendConfig {
    return { ...this.config };
  }
}