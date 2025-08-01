/**
 * Tunnel Service
 * 
 * Manages cloudflared tunnel connections following the event-driven architecture.
 * Integrates with server lifecycle and emits tunnel status events.
 */

import { spawn, ChildProcess } from 'child_process';
import type { EventBus } from '../core/services/event-bus.service';
import { ServerEvents } from '../core/types/events.types';
import type { IServerCore } from '../core/types/server.types';

export interface TunnelConfig {
  token?: string;
  url?: string;
  enabled: boolean;
  healthCheckInterval: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface TunnelStatus {
  connected: boolean;
  url?: string;
  error?: string;
  lastHealthCheck?: Date;
  startTime?: Date;
  pid?: number;
}

export class TunnelService {
  private tunnelProcess?: ChildProcess;
  private config: TunnelConfig;
  private status: TunnelStatus = { connected: false };
  private healthCheckTimer?: NodeJS.Timeout;
  private retryTimer?: NodeJS.Timeout;
  private retryCount = 0;

  constructor(
    private readonly eventBus: EventBus,
    private readonly serverCore?: IServerCore
  ) {
    this.config = this.loadConfig();
    this.setupEventListeners();
  }

  /**
   * Load tunnel configuration from environment and config.
   */
  private loadConfig(): TunnelConfig {
    const token = process.env.CLOUDFLARE_TUNNEL_TOKEN;
    const enabled = process.env.ENABLE_OAUTH_TUNNEL === 'true' || Boolean(token);
    
    return {
      token,
      url: process.env.TUNNEL_URL || process.env.BASE_URL,
      enabled,
      healthCheckInterval: parseInt(process.env.TUNNEL_HEALTH_INTERVAL || '30000', 10),
      retryAttempts: parseInt(process.env.TUNNEL_RETRY_ATTEMPTS || '3', 10),
      retryDelay: parseInt(process.env.TUNNEL_RETRY_DELAY || '5000', 10)
    };
  }

  /**
   * Set up event listeners for server lifecycle.
   */
  private setupEventListeners(): void {
    this.eventBus.on(ServerEvents.SERVER_STARTING, () => {
      if (this.config.enabled) {
        this.start().catch(error => {
          this.eventBus.emit(ServerEvents.ERROR, {
            source: 'tunnel-service',
            error: error.message,
            details: { phase: 'startup' }
          });
        });
      }
    });

    this.eventBus.on(ServerEvents.SERVER_STOPPING, () => {
      this.stop().catch(error => {
        this.eventBus.emit(ServerEvents.ERROR, {
          source: 'tunnel-service',
          error: error.message,
          details: { phase: 'shutdown' }
        });
      });
    });

    // Register tunnel status endpoint
    this.eventBus.on('tunnel.status', () => {
      this.eventBus.emit(ServerEvents.REQUEST_RESPONSE, {
        data: this.getStatus()
      });
    });
  }

  /**
   * Start the tunnel connection.
   */
  async start(): Promise<void> {
    if (!this.config.enabled || !this.config.token) {
      this.emitStatusUpdate({ 
        connected: false, 
        error: 'Tunnel not enabled or no token provided' 
      });
      return;
    }

    if (this.tunnelProcess) {
      return; // Already running
    }

    try {
      await this.startTunnelProcess();
      this.startHealthChecking();
      this.retryCount = 0;
    } catch (error) {
      this.handleTunnelError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Stop the tunnel connection.
   */
  async stop(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }

    if (this.tunnelProcess) {
      return new Promise<void>((resolve) => {
        if (!this.tunnelProcess) {
          resolve();
          return;
        }

        this.tunnelProcess.once('exit', () => {
          this.tunnelProcess = undefined;
          this.emitStatusUpdate({ 
            connected: false, 
            url: undefined,
            pid: undefined 
          });
          resolve();
        });

        // Try graceful shutdown first
        this.tunnelProcess.kill('SIGTERM');

        // Force kill after 5 seconds
        setTimeout(() => {
          if (this.tunnelProcess) {
            this.tunnelProcess.kill('SIGKILL');
          }
        }, 5000);
      });
    }
  }

  /**
   * Get current tunnel status.
   */
  getStatus(): TunnelStatus {
    return { ...this.status };
  }

  /**
   * Start the cloudflared tunnel process.
   */
  private async startTunnelProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if cloudflared is available
      const checkProcess = spawn('which', ['cloudflared'], { stdio: 'pipe' });
      
      checkProcess.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error('cloudflared not found. Please install cloudflared.'));
          return;
        }

        // Start the tunnel
        this.tunnelProcess = spawn('cloudflared', [
          'tunnel',
          'run',
          '--token',
          this.config.token!
        ], {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false
        });

        this.tunnelProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          console.log(`[TUNNEL] ${output.trim()}`);
          
          // Look for connection success indicators
          if (output.includes('cloudflared.exe')) {
            this.handleTunnelConnected();
          }
          
          // Extract tunnel URL if present
          const urlMatch = output.match(/https:\/\/[^\s]+/);
          if (urlMatch) {
            this.config.url = urlMatch[0];
            this.emitStatusUpdate({ url: this.config.url });
          }
        });

        this.tunnelProcess.stderr?.on('data', (data) => {
          const error = data.toString();
          console.error(`[TUNNEL ERROR] ${error.trim()}`);
          
          if (error.includes('connected')) {
            this.handleTunnelConnected();
          }
        });

        this.tunnelProcess.on('exit', (code, signal) => {
          console.log(`[TUNNEL] Process exited with code ${code}, signal ${signal}`);
          this.tunnelProcess = undefined;
          
          if (code !== 0 && code !== null) {
            this.handleTunnelError(new Error(`Tunnel process exited with code ${code}`));
          } else {
            this.emitStatusUpdate({ 
              connected: false, 
              url: undefined,
              pid: undefined 
            });
          }
        });

        this.tunnelProcess.on('error', (error) => {
          this.handleTunnelError(error);
          reject(error);
        });

        // Consider it started after a brief delay
        setTimeout(() => {
          if (this.tunnelProcess) {
            this.emitStatusUpdate({ 
              connected: true,
              startTime: new Date(),
              pid: this.tunnelProcess.pid,
              url: this.config.url
            });
            resolve();
          } else {
            reject(new Error('Tunnel process failed to start'));
          }
        }, 2000);
      });
    });
  }

  /**
   * Handle successful tunnel connection.
   */
  private handleTunnelConnected(): void {
    this.emitStatusUpdate({
      connected: true,
      error: undefined,
      lastHealthCheck: new Date(),
      url: this.config.url
    });

    this.eventBus.emit(ServerEvents.TUNNEL_CONNECTED, {
      url: this.config.url,
      timestamp: new Date()
    });
  }

  /**
   * Handle tunnel errors with retry logic.
   */
  private handleTunnelError(error: Error): void {
    console.error('[TUNNEL ERROR]', error.message);
    
    this.emitStatusUpdate({
      connected: false,
      error: error.message,
      url: undefined,
      pid: undefined
    });

    this.eventBus.emit(ServerEvents.TUNNEL_ERROR, {
      error: error.message,
      retryCount: this.retryCount,
      timestamp: new Date()
    });

    // Retry logic
    if (this.retryCount < this.config.retryAttempts) {
      this.retryCount++;
      console.log(`[TUNNEL] Retrying connection in ${this.config.retryDelay}ms (attempt ${this.retryCount}/${this.config.retryAttempts})`);
      
      this.retryTimer = setTimeout(() => {
        this.start().catch(retryError => {
          console.error('[TUNNEL RETRY ERROR]', retryError.message);
        });
      }, this.config.retryDelay);
    }
  }

  /**
   * Start health checking.
   */
  private startHealthChecking(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck().catch(error => {
        console.error('[TUNNEL HEALTH CHECK ERROR]', error.message);
      });
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform tunnel health check.
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.config.url || !this.status.connected) {
      return;
    }

    try {
      // Try to fetch health endpoint through tunnel
      const response = await fetch(`${this.config.url}/health`, {
        timeout: 10000,
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        this.emitStatusUpdate({
          lastHealthCheck: new Date(),
          error: undefined
        });
      } else {
        throw new Error(`Health check failed with status ${response.status}`);
      }
    } catch (error) {
      this.handleTunnelError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Emit tunnel status update.
   */
  private emitStatusUpdate(updates: Partial<TunnelStatus>): void {
    this.status = { ...this.status, ...updates };
    
    this.eventBus.emit(ServerEvents.TUNNEL_STATUS_CHANGED, {
      status: this.getStatus(),
      timestamp: new Date()
    });
  }
}