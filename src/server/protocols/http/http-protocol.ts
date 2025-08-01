/**
 * HTTP Protocol Handler.
 * Handles HTTP requests using Express and routes them via events.
 */

import express from 'express';
import cors from 'cors';
import type {
 Express, NextFunction, Request, Response
} from 'express';
import type { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import type {
 IProtocolHandler, IServerCore, ProtocolHealth, ServerStatus
} from '../../core/types/server.types';
import type { RequestEvent } from '../../core/types/events.types';
import { ServerEvents } from '../../core/types/events.types';
import type { HttpEndpoint, HttpRequestContext } from './types/http.types';
import { EndpointRegistry } from '../../integration/endpoint-registry';

export class HttpProtocolHandler implements IProtocolHandler {
  public readonly name = 'http';
  private server?: IServerCore;
  public app?: Express;
  private httpServer?: Server;
  private status: ServerStatus = 'initialized';
  private endpointRegistry?: EndpointRegistry;
  private readonly activeRequests = new Map<string, HttpRequestContext>();
  private readonly rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  async initialize(server: IServerCore): Promise<boolean> {
    this.server = server;
    this.app = express();

    this.endpointRegistry = new EndpointRegistry(server.eventBus);

    this.setupMiddleware();

    this.setupEventHandlers();

    this.setupRoutes();
    
    // Register self as a service for other protocols to use
    server.registerService('http-handler', this);

    return true;
  }

  async start(): Promise<void> {
    if (!this.app || !this.server) {
      throw new Error('HTTP protocol not initialized');
    }

    const port = this.server.getPort();

    await new Promise((resolve, reject) => {
      this.httpServer = this.app!.listen(port, '0.0.0.0', () => {
        this.status = 'running';
        
        // Report actual bound port to server
        const address = this.httpServer!.address();
        if (address && typeof address !== 'string') {
          this.server!.eventBus.emit(ServerEvents.PROTOCOL_PORT_BOUND, {
            protocol: 'http',
            port: address.port
          });
        }
        
        resolve(undefined);
      });

      this.httpServer.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => {
          this.status = 'stopped';
          resolve(undefined);
        });
      });
    }
  }

  getStatus(): ServerStatus {
    return this.status;
  }

  async getHealth(): Promise<ProtocolHealth> {
    return {
      healthy: this.status === 'running',
      details: {
        activeRequests: this.activeRequests.size,
        registeredEndpoints: this.endpointRegistry?.getEndpoints().length || 0
      }
    };
  }

  private setupMiddleware(): void {
    if (!this.app) { return; }

    this.app.use(cors({
      origin: true,
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'X-Custom-Header',
        'X-Request-ID'
      ],
      exposedHeaders: ['X-Request-ID']
    }));

    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({
 extended: true,
limit: '50mb'
}));

    this.app.use((_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });

    this.app.use((req: any, res, next) => {
      req.requestId = req.headers['x-request-id'] || uuidv4();
      res.setHeader('X-Request-ID', req.requestId);
      next();
    });
  }

  private setupEventHandlers(): void {
    if (!this.server) { return; }

    this.server.eventBus.on(ServerEvents.REGISTER_ENDPOINTS, (event) => {
      const { moduleId, endpoints } = event;

      for (const endpoint of endpoints) {
        if (endpoint.protocol === 'http') {
          try {
            this.endpointRegistry!.registerEndpoint({
              ...endpoint,
              moduleId
            });
          } catch (error) {
            this.server!.eventBus.emit(ServerEvents.REGISTRATION_ERROR, {
              moduleId,
              endpoint,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    });

    this.server.eventBus.on(ServerEvents.MODULE_SHUTDOWN, (event) => {
      const { moduleId } = event;
      this.endpointRegistry!.unregisterModuleEndpoints(moduleId);
    });
  }

  private setupRoutes(): void {
    if (!this.app || !this.server) { return; }

    this.app.get('/debug/headers', (req, res) => {
      res.json({ headers: req.headers });
    });

    this.app.all('/api/echo', (req, res) => {
      res.json({
        method: req.method,
        headers: req.headers,
        body: req.body,
        query: req.query,
        size: JSON.stringify(req.body).length
      });
    });
  }

  /**
   * Add static routes before the dynamic router.
   * This should be called after routes are added but before starting the server.
   */
  public finalizeRoutes(): void {
    if (!this.app || !this.server) { return; }

    // Add the dynamic route handler
    this.app.use(async (req, res, next) => {
      await this.handleDynamicRoute(req, res, next);
    });

    // Add the 404 handler last
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        message: `The endpoint ${req.method} ${req.path} does not exist`,
        timestamp: new Date().toISOString()
      });
    });

    this.app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      if (err.type === 'entity.parse.failed') {
        res.status(400).json({
          error: 'Invalid JSON',
          message: 'The request body contains invalid JSON'
        });
      } else {
        res.status(500).json({
          error: 'Internal server error',
          message: 'An unexpected error occurred'
        });
      }
    });
  }

  private async handleDynamicRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!this.endpointRegistry || !this.server) {
      next(); return;
    }

    const endpoint = this.endpointRegistry.matchEndpoint(req.method, req.path);
    if (!endpoint) {
      next(); return;
    }

    const requestId = (req as any).requestId || uuidv4();
    const context: HttpRequestContext = {
      endpoint,
      request: req,
      response: res,
      startTime: Date.now()
    };

    this.activeRequests.set(requestId, context);

    try {
      if (endpoint.auth?.required) {
        const authResult = await this.checkAuthentication(req, endpoint);
        if (!authResult.authenticated) {
          this.activeRequests.delete(requestId);
          res.status(authResult.statusCode || 401).json({
            error: authResult.error || 'Unauthorized',
            message: authResult.message || 'Authentication required'
          });
          return;
        }

        (req as any).auth = authResult.auth;
      }

      if (endpoint.validation) {
        const validationError = await this.validateRequest(req, endpoint.validation);
        if (validationError) {
          this.activeRequests.delete(requestId);
          res.status(400).json({
            error: 'Validation error',
            message: validationError
          });
          return;
        }
      }

      if (endpoint.rateLimit) {
        const rateLimitResult = await this.checkRateLimit(req, endpoint);
        if (rateLimitResult.limited) {
          this.activeRequests.delete(requestId);
          res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded'
          });
          return;
        }
      }

      const params = this.endpointRegistry.extractParams(req.path, endpoint.path as string);

      const requestEvent: RequestEvent = {
        requestId,
        method: req.method,
        path: req.path,
        params,
        query: req.query,
        headers: req.headers as Record<string, string>,
        body: req.body,
        auth: (req as any).auth,
        moduleId: endpoint.moduleId,
        handler: endpoint.handler,
        clientIp: this.getClientIp(req),
        isProxied: this.isProxied(req),
        protocol: this.getProtocol(req)
      };

      if (endpoint.streaming) {
        await this.handleStreamingRequest(requestEvent, res, endpoint);
      } else {
        await this.handleStandardRequest(requestEvent, res, endpoint);
      }
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    } finally {
      this.activeRequests.delete(requestId);

      this.server.eventBus.emit(ServerEvents.REQUEST_METRICS, {
        requestId,
        path: req.path,
        method: req.method,
        moduleId: endpoint.moduleId,
        handler: endpoint.handler,
        duration: Date.now() - context.startTime,
        success: !res.headersSent || res.statusCode < 400
      });
    }
  }

  private async handleStandardRequest(
    event: RequestEvent,
    res: Response,
    endpoint: HttpEndpoint
  ): Promise<void> {
    const timeout = endpoint.timeout || 30000;

    try {
      const response = await this.server!.eventBus.emitAndWait(
        endpoint.handler,
        event,
        { timeout }
      );

      if (response.error) {
        const statusCode = response.error.statusCode || 500;
        res.status(statusCode).json({
          error: response.error.code || 'ERROR',
          message: response.error.message || 'An error occurred'
        });
      } else if (response.data?.redirect) {
        // Handle redirect responses
        if (response.data.sessionId) {
          // Set session cookie if provided
          res.cookie('session_id', response.data.sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
          });
        }
        res.redirect(302, response.data.redirect);
      } else {
        res.json(response.data);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        res.status(504).json({
          error: 'Gateway timeout',
          message: 'The request timed out'
        });
      } else {
        res.status(500).json({
          error: 'Internal server error',
          message: 'An unexpected error occurred'
        });
      }
    }
  }

  private async handleStreamingRequest(
    event: RequestEvent,
    res: Response,
    endpoint: HttpEndpoint
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const streamEvent = `stream.${event.requestId}`;

    const streamHandler = (data: any) => {
      if (data.done) {
        res.end();
      } else {
        res.write(`data: ${JSON.stringify(data.chunk)}\n\n`);
      }
    };

    this.server!.eventBus.on(streamEvent, streamHandler);

    res.on('close', () => {
      this.server!.eventBus.off(streamEvent, streamHandler);
    });

    this.server!.eventBus.emit(endpoint.handler, event);
  }

  private async checkAuthentication(req: Request, endpoint: HttpEndpoint): Promise<any> {
    let token: string | null = null;
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if ((req as any).cookies?.auth_token) {
      token = (req as any).cookies.auth_token;
    } else if (typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token && endpoint.auth?.sessionBased) {
      const sessionResponse = await this.server!.eventBus.emitAndWait(
        'auth.extract.session',
        {
          requestId: uuidv4(),
          headers: req.headers
        },
        { timeout: 1000 }
      );

      if (sessionResponse.data?.sessionId) {
        const validateResponse = await this.server!.eventBus.emitAndWait(
          'auth.session.validate',
          {
            requestId: uuidv4(),
            sessionId: sessionResponse.data.sessionId
          },
          { timeout: 1000 }
        );

        if (validateResponse.data?.valid) {
          return {
            authenticated: true,
            auth: {
              authenticated: true,
              userId: validateResponse.data.userId,
              sessionId: sessionResponse.data.sessionId
            }
          };
        } else if (validateResponse.data) {
          // Session validation failed
          return {
            authenticated: false,
            statusCode: 401,
            error: 'Unauthorized',
            message: validateResponse.data.reason || 'Invalid session'
          };
        }
      }
    }

    if (!token && endpoint.auth?.strategy) {
      const strategyResponse = await this.server!.eventBus.emitAndWait(
        `auth.strategy.${endpoint.auth.strategy}`,
        {
          requestId: uuidv4(),
          headers: req.headers
        },
        { timeout: 1000 }
      );

      if (strategyResponse.data?.authenticated) {
        return {
          authenticated: true,
          auth: strategyResponse.data
        };
      }
    }

    if (!token) {
      this.server!.eventBus.emit(ServerEvents.AUTH_FAILURE, {
        reason: 'No authentication provided',
        path: req.path,
        method: req.method
      });

      return {
        authenticated: false,
        statusCode: 401,
        error: 'Unauthorized',
        message: 'No authentication token provided'
      };
    }

    try {
      const validationResponse = await this.server!.eventBus.emitAndWait(
        'auth.validate',
        {
          requestId: uuidv4(),
          token
        },
        { timeout: 5000 }
      );

      const result = validationResponse.data;

      if (!result.valid) {
        this.server!.eventBus.emit(ServerEvents.AUTH_FAILURE, {
          reason: result.reason || 'Invalid token',
          path: req.path,
          method: req.method
        });

        return {
          authenticated: false,
          statusCode: 401,
          error: 'Unauthorized',
          message: result.reason || 'Invalid authentication token'
        };
      }

      if (endpoint.auth?.roles && endpoint.auth.roles.length > 0) {
        const rolesResponse = await this.server!.eventBus.emitAndWait(
          'auth.check.roles',
          {
            requestId: uuidv4(),
            userId: result.userId,
            roles: endpoint.auth.roles
          },
          { timeout: 1000 }
        );

        if (!rolesResponse.data?.hasRoles) {
          return {
            authenticated: false,
            statusCode: 403,
            error: 'Forbidden',
            message: 'Insufficient permissions'
          };
        }
      }

      if (endpoint.auth?.scopes && endpoint.auth.scopes.length > 0) {
        const hasRequiredScopes = endpoint.auth.scopes.every(scope => { return result.scopes?.includes(scope) });

        if (!hasRequiredScopes) {
          return {
            authenticated: false,
            statusCode: 403,
            error: 'Forbidden',
            message: 'Insufficient scopes'
          };
        }
      }

      this.server!.eventBus.emit(ServerEvents.AUTH_SUCCESS, {
        userId: result.userId,
        path: req.path,
        method: req.method
      });

      return {
        authenticated: true,
        auth: {
          authenticated: true,
          userId: result.userId,
          scopes: result.scopes,
          sessionId: result.sessionId
        }
      };
    } catch (error) {
      return {
        authenticated: false,
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication failed'
      };
    }
  }

  private async validateRequest(req: Request, validation: any): Promise<string | null> {
    if (validation.body && req.body) {
      const result = this.validateObject(req.body, validation.body);
      if (result) { return `Body validation failed: ${result}`; }
    }

    if (validation.query && req.query) {
      const result = this.validateObject(req.query, validation.query);
      if (result) { return `Query validation failed: ${result}`; }
    }

    if (validation.params && req.params) {
      const result = this.validateObject(req.params, validation.params);
      if (result) { return `Params validation failed: ${result}`; }
    }

    return null;
  }

  private validateObject(obj: any, schema: any): string | null {
    if (schema?.type === 'object' && schema?.properties) {
      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in obj)) {
            return `Missing required field: ${field}`;
          }
        }
      }

      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (field in obj) {
          const value = obj[field];
          const fieldSchemaObj = fieldSchema as any;
          const type = fieldSchemaObj?.type;

          if (type === 'string' && typeof value !== 'string') {
            return `Field ${field} must be a string`;
          }
          if (type === 'number' && typeof value !== 'number') {
            return `Field ${field} must be a number`;
          }
          if (type === 'boolean' && typeof value !== 'boolean') {
            return `Field ${field} must be a boolean`;
          }

          if (type === 'string' && fieldSchemaObj?.minLength && value.length < fieldSchemaObj.minLength) {
            return `Field ${field} must be at least ${fieldSchemaObj.minLength} characters`;
          }

          if (type === 'number' && fieldSchemaObj?.minimum !== undefined && value < fieldSchemaObj.minimum) {
            return `Field ${field} must be at least ${fieldSchemaObj.minimum}`;
          }
        }
      }
    }

    return null;
  }

  private async checkRateLimit(req: Request, endpoint: HttpEndpoint): Promise<{ limited: boolean }> {
    if (!endpoint.rateLimit) {
      return { limited: false };
    }
    
    const key = `${endpoint.path}:${this.getClientIp(req)}`;
    const now = Date.now();
    const windowMs = endpoint.rateLimit.window; // Already in milliseconds
    
    // Get or create rate limit entry
    let entry = this.rateLimitStore.get(key);
    
    // If no entry or window has expired, create new entry
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs
      };
      this.rateLimitStore.set(key, entry);
      return { limited: false };
    }
    
    // Increment count
    entry.count++;
    
    // Check if limit exceeded
    if (entry.count > endpoint.rateLimit.max) {
      return { limited: true };
    }
    
    return { limited: false };
  }

  private getClientIp(req: Request): string {
    const cfIp = req.headers['cf-connecting-ip'];
    if (cfIp && typeof cfIp === 'string') { return cfIp; }

    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() || forwarded.trim();
    }

    return req.socket?.remoteAddress || 'unknown';
  }

  private isProxied(req: Request): boolean {
    return Boolean(req.headers['x-forwarded-for']
      || req.headers['x-forwarded-proto']
      || req.headers['cf-ray']
      || req.headers['cf-connecting-ip']);
  }
  
  private getProtocol(req: Request): string {
    // Check X-Forwarded-Proto header if behind proxy
    const forwardedProto = req.headers['x-forwarded-proto'];
    if (forwardedProto && typeof forwardedProto === 'string') {
      return forwardedProto;
    }
    
    // Fall back to req.protocol
    return req.protocol;
  }
}
