/**
 * Server Core.
 * Main server class that manages lifecycle, protocols, and services
 * without any direct module dependencies.
 */

import { EventBus } from '@/server/core/services/event-bus.service';
import { ServiceRegistry } from '@/server/core/services/registry.service';
import { TunnelService } from '@/server/services/tunnel.service';
import type {
  GracefulShutdownOptions,
  IProtocolHandler,
  IServerCore,
  ServerConfig,
  ServerHealth,
  ServerStatus
} from '@/server/core/types/server.types';
import { ServerEvents } from '@/server/core/types/events.types';

export class ServerCore implements IServerCore {
  public readonly eventBus: EventBus;
  private readonly serviceRegistry: ServiceRegistry;
  private readonly tunnelService: TunnelService;
  private readonly config: Required<ServerConfig>;
  private readonly protocols: Map<string, IProtocolHandler> = new Map();
  private readonly connections: Set<any> = new Set();
  private status: ServerStatus = 'initialized';
  private startTime: number = 0;
  private actualPort: number = 0;

  constructor(config: ServerConfig) {
    if (config.port < 0 || config.port > 65535) {
      throw new Error('Invalid port number');
    }

    this.config = {
      port: config.port,
      name: config.name || 'systemprompt-os-server',
      eventBus: {
        maxListeners: config.eventBus?.maxListeners || 100,
        wildcard: config.eventBus?.wildcard !== false
      }
    };

    this.eventBus = new EventBus(this.config.eventBus);
    this.serviceRegistry = new ServiceRegistry();
    this.tunnelService = new TunnelService(this.eventBus, this);

    // Register tunnel service
    this.serviceRegistry.register('tunnel', this.tunnelService);

    this.setupInternalHandlers();
  }

  /**
   * Start the server.
   */
  async start(): Promise<void> {
    if (this.status !== 'initialized' && this.status !== 'stopped') {
      throw new Error(`Cannot start server in ${this.status} state`);
    }

    this.status = 'starting';
    this.startTime = Date.now();

    this.eventBus.emit(ServerEvents.STARTING, {
      port: this.config.port,
      name: this.config.name
    });

    try {
      // For dynamic ports (port 0), set up listener before starting protocols
      let portBoundPromise: Promise<void> | null = null;
      
      if (this.config.port === 0) {
        portBoundPromise = new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('Timeout waiting for port binding, using default');
            this.actualPort = 3000;
            resolve();
          }, 1000);
          
          const handler = (event: { protocol: string; port: number }) => {
            if (event.protocol === 'http') {
              clearTimeout(timeout);
              this.eventBus.off(ServerEvents.PROTOCOL_PORT_BOUND, handler);
              resolve();
            }
          };
          
          this.eventBus.on(ServerEvents.PROTOCOL_PORT_BOUND, handler);
        });
      } else {
        this.actualPort = this.config.port;
      }
      
      // Start all protocols
      for (const [name, protocol] of this.protocols) {
        await protocol.start();
        this.eventBus.emit(ServerEvents.PROTOCOL_STARTED, { name });
      }

      // Wait for port binding if needed
      if (portBoundPromise) {
        await portBoundPromise;
      }
      
      this.status = 'running';

      this.eventBus.emit(ServerEvents.STARTED, {
        port: this.actualPort,
        name: this.config.name
      });
    } catch (error) {
      this.status = 'error';
      this.eventBus.emit(ServerEvents.ERROR, {
        error: error as Error,
        context: 'start'
      });
      throw error;
    }
  }

  /**
   * Stop the server.
   * @param options
   */
  async stop(options: GracefulShutdownOptions = {}): Promise<void> {
    if (this.status !== 'running') {
      return;
    }

    const { gracefulTimeout = 30000, force = false } = options;

    this.status = 'stopping';
    this.eventBus.emit(ServerEvents.STOPPING, {
      reason: 'Shutdown requested'
    });

    try {
      const shutdownPromise = this.performShutdown();

      if (gracefulTimeout > 0 && !force) {
        await Promise.race([
          shutdownPromise,
          new Promise((_, reject) =>
            { return setTimeout(() => { reject(new Error('Shutdown timeout')); }, gracefulTimeout) })
        ]);
      } else {
        await shutdownPromise;
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Shutdown timeout') {
        await this.forceShutdown();
      } else {
        throw error;
      }
    } finally {
      this.status = 'stopped';
      this.eventBus.emit(ServerEvents.STOPPED, {
        reason: 'Shutdown completed'
      });
    }
  }

  /**
   * Restart the server.
   */
  async restart(): Promise<void> {
    const wasRunning = this.status === 'running';
    const savedPort = this.actualPort;

    if (wasRunning) {
      await this.stop();
    }

    if (savedPort && this.config.port === 0) {
      this.config.port = savedPort;
    }

    await this.start();
  }

  /**
   * Register a protocol handler.
   * @param name
   * @param handler
   */
  async registerProtocol(name: string, handler: IProtocolHandler): Promise<void> {
    if (this.protocols.has(name)) {
      throw new Error(`Protocol '${name}' is already registered`);
    }

    const initialized = await handler.initialize(this);
    if (!initialized) {
      throw new Error(`Failed to initialize protocol '${name}'`);
    }

    this.protocols.set(name, handler);

    if (this.status === 'running') {
      await handler.start();
      this.eventBus.emit(ServerEvents.PROTOCOL_STARTED, { name });
    }

    this.eventBus.emit(ServerEvents.PROTOCOL_REGISTERED, {
      name,
      protocol: handler
    });
  }

  /**
   * Register a service.
   * @param name
   * @param service
   */
  registerService(name: string, service: any): void {
    this.serviceRegistry.register(name, service);
    this.eventBus.emit(ServerEvents.SERVICE_REGISTERED, {
      name,
      service
    });
  }

  /**
   * Get a service.
   * @param name
   */
  getService(name: string): any {
    return this.serviceRegistry.get(name);
  }

  /**
   * Track a connection.
   * @param connection
   */
  trackConnection(connection: any): void {
    this.connections.add(connection);
  }

  /**
   * Get server port.
   */
  getPort(): number {
    return this.actualPort || this.config.port;
  }

  /**
   * Get server name.
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Get server status.
   */
  getStatus(): ServerStatus {
    return this.status;
  }

  /**
   * Get registered protocols.
   */
  getProtocols(): string[] {
    return Array.from(this.protocols.keys());
  }

  /**
   * Get protocol handler.
   * @param name
   */
  getProtocolHandler(name: string): IProtocolHandler | undefined {
    return this.protocols.get(name);
  }

  /**
   * Get service registry.
   */
  getServiceRegistry(): ServiceRegistry {
    return this.serviceRegistry;
  }

  /**
   * Get server health.
   */
  async getHealth(): Promise<ServerHealth> {
    const protocols = await Promise.all(
      Array.from(this.protocols.entries()).map(async ([name, protocol]) => {
        const health = protocol.getHealth ? await protocol.getHealth() : undefined;
        return {
          name,
          status: protocol.getStatus(),
          health
        };
      })
    );

    const hasUnhealthy = protocols.some(p =>
      { return p.health && !p.health.healthy || p.status === 'error' });

    return {
      status: hasUnhealthy ? 'degraded' : 'healthy',
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      protocols,
      services: this.serviceRegistry.getServiceNames(),
      eventBus: {
        status: 'active',
        pendingEvents: this.eventBus.getPendingCount()
      }
    };
  }

  /**
   * Check if phase has been completed.
   * @param phase
   */
  hasCompletedPhase(phase: string): boolean {
    const phaseMap: Record<string, boolean> = {
      init: this.status !== 'initialized',
      core_modules: this.status === 'running' || this.status === 'stopped',
      ready: this.status === 'running'
    };

    return phaseMap[phase] || false;
  }

  /**
   * Get current phase (for compatibility).
   */
  getCurrentPhase(): string {
    const statusToPhase: Record<ServerStatus, string> = {
      initialized: 'init',
      starting: 'starting',
      running: 'ready',
      stopping: 'stopping',
      stopped: 'init',
      error: 'error'
    };

    return statusToPhase[this.status];
  }

  /**
   * Set up internal event handlers.
   */
  private setupInternalHandlers(): void {
    this.eventBus.on('internal.error', (error: Error) => {
      this.eventBus.emit(ServerEvents.ERROR, {
        error,
        context: 'internal'
      });
    });
    
    // Handle protocol port binding for dynamic ports
    this.eventBus.on(ServerEvents.PROTOCOL_PORT_BOUND, (event: { protocol: string; port: number }) => {
      if (event.protocol === 'http' && this.config.port === 0) {
        this.actualPort = event.port;
      }
    });
  }

  /**
   * Perform shutdown.
   */
  private async performShutdown(): Promise<void> {
    // First wait for any active async event handlers to complete
    await this.eventBus.waitForActiveHandlers(5000);
    
    for (const connection of this.connections) {
      if (connection.close && typeof connection.close === 'function') {
        connection.close();
      }
    }
    this.connections.clear();

    for (const [name, protocol] of this.protocols) {
      await protocol.stop();
      this.eventBus.emit(ServerEvents.PROTOCOL_STOPPED, { name });
    }

    // Wait for any remaining pending requests
    const pendingCount = this.eventBus.getPendingCount();
    if (pendingCount > 0) {
      await new Promise(resolve => { return setTimeout(resolve, 100) });
    }
  }

  /**
   * Force shutdown.
   */
  private async forceShutdown(): Promise<void> {
    this.eventBus.clearPending();

    this.connections.clear();

    for (const protocol of this.protocols.values()) {
      try {
        await protocol.stop();
      } catch (error) {
      }
    }
  }

  // For test compatibility
  getModules(): Map<string, any> {
    return new Map();
  }

  getModule(name: string): any {
    return undefined;
  }

  async shutdown(): Promise<void> {
    await this.stop();
  }

  async bootstrap(): Promise<Map<string, any>> {
    await this.start();
    return this.getModules();
  }
}
