/**
 * Core Server Types.
 * Defines interfaces and types for the server core.
 */

import type { EventBus } from '../services/event-bus.service';
import type { ServiceRegistry } from '../services/registry.service';

export interface ServerConfig {
  port: number;
  name?: string;
  eventBus?: {
    maxListeners?: number;
    wildcard?: boolean;
  };
}

export type ServerStatus = 'initialized' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';

export interface IProtocolHandler {
  name: string;

  initialize(server: IServerCore): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): ServerStatus;
  getHealth?(): Promise<ProtocolHealth>;
}

export interface IServerCore {
  eventBus: EventBus;

  getPort(): number;
  getName(): string;
  getStatus(): ServerStatus;
  getServiceRegistry(): ServiceRegistry;

  registerService(name: string, service: any): void;
  getService(name: string): any;

  trackConnection(connection: any): void;
}

export interface ProtocolHealth {
  healthy: boolean;
  reason?: string;
  details?: any;
}

export interface ServerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  protocols: Array<{
    name: string;
    status: ServerStatus;
    health?: ProtocolHealth;
  }>;
  services: string[];
  eventBus: {
    status: 'active' | 'error';
    pendingEvents: number;
  };
}

export interface GracefulShutdownOptions {
  gracefulTimeout?: number;
  force?: boolean;
}
