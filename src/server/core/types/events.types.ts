/**
 * Server Event Types.
 * Defines all events used by the server core and protocols.
 */

export enum ServerEvents {
  // Lifecycle events
  STARTING = 'server.starting',
  STARTED = 'server.started',
  STOPPING = 'server.stopping',
  STOPPED = 'server.stopped',
  ERROR = 'server.error',

  // Protocol events
  PROTOCOL_REGISTERED = 'server.protocol.registered',
  PROTOCOL_STARTED = 'server.protocol.started',
  PROTOCOL_STOPPED = 'server.protocol.stopped',
  PROTOCOL_PORT_BOUND = 'server.protocol.port.bound',

  // Service events
  SERVICE_REGISTERED = 'server.service.registered',
  SERVICE_UNREGISTERED = 'server.service.unregistered',

  // Module integration events
  REGISTER_ENDPOINTS = 'server.endpoints.register',
  UNREGISTER_ENDPOINTS = 'server.endpoints.unregister',
  REGISTRATION_ERROR = 'server.registration.error',
  MODULE_SHUTDOWN = 'server.module.shutdown',

  // MCP specific events
  REGISTER_MCP_CONTEXT = 'server.mcp.context.register',
  REGISTER_MCP_TOOLS = 'server.mcp.tools.register',
  REGISTER_WS_TOPICS = 'server.ws.topics.register',

  // Request/Response events
  REQUEST_RECEIVED = 'server.request.received',
  REQUEST_COMPLETED = 'server.request.completed',
  REQUEST_METRICS = 'server.request.metrics',
  BROADCAST = 'server.broadcast',

  // Middleware events
  REQUEST_MIDDLEWARE = 'server.middleware.request',
  RESPONSE_MIDDLEWARE = 'server.middleware.response',
  AUTH_MIDDLEWARE = 'server.middleware.auth',

  // Authentication events
  AUTH_SUCCESS = 'server.auth.success',
  AUTH_FAILURE = 'server.auth.failure',

  // Tunnel events
  TUNNEL_CONNECTED = 'server.tunnel.connected',
  TUNNEL_ERROR = 'server.tunnel.error',
  TUNNEL_STATUS_CHANGED = 'server.tunnel.status.changed',

  // Lifecycle aliases for compatibility
  SERVER_STARTING = 'server.starting',
  SERVER_STARTED = 'server.started', 
  SERVER_STOPPING = 'server.stopping',
  SERVER_STOPPED = 'server.stopped',
}

export interface ServerEventMap {
  [ServerEvents.STARTING]: { port: number; name: string };
  [ServerEvents.STARTED]: { port: number; name: string };
  [ServerEvents.STOPPING]: { reason?: string };
  [ServerEvents.STOPPED]: { reason?: string };
  [ServerEvents.ERROR]: { error: Error; context?: string };

  [ServerEvents.PROTOCOL_REGISTERED]: { name: string; protocol: any };
  [ServerEvents.SERVICE_REGISTERED]: { name: string; service: any };

  [ServerEvents.REGISTER_ENDPOINTS]: {
    moduleId: string;
    endpoints: any[];
  };

  [ServerEvents.REGISTER_MCP_CONTEXT]: {
    moduleId: string;
    context: string;
    capabilities: any;
    metadata?: any;
    auth?: any;
  };

  [ServerEvents.TUNNEL_CONNECTED]: {
    url?: string;
    timestamp: Date;
  };

  [ServerEvents.TUNNEL_ERROR]: {
    error: string;
    retryCount: number;
    timestamp: Date;
  };

  [ServerEvents.TUNNEL_STATUS_CHANGED]: {
    status: {
      connected: boolean;
      url?: string;
      error?: string;
      lastHealthCheck?: Date;
      startTime?: Date;
      pid?: number;
    };
    timestamp: Date;
  };
}

export interface RequestEvent {
  requestId: string;
  method: string;
  path: string;
  params: Record<string, any>;
  query: Record<string, any>;
  headers: Record<string, string>;
  body: any;
  auth?: {
    authenticated: boolean;
    userId?: string;
    scopes?: string[];
    sessionId?: string;
  };
  user?: any;
  clientIp?: string;
  isProxied?: boolean;
  protocol?: string;
  moduleId?: string;
  handler?: string;
  [key: string]: any;
}

export interface ResponseEvent {
  requestId: string;
  data?: any;
  error?: {
    code: string;
    message: string;
    statusCode?: number;
    details?: any;
  };
}
