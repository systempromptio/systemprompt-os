/**
 * Module Bridge
 * 
 * Bridges the gap between the server and modules using events
 */

import { EventBus } from '../core/services/event-bus.service';
import { EndpointRegistry } from './endpoint-registry';
import { ServerEvents } from '../core/types/events.types';
import type { 
  EndpointDefinition, 
  ModuleRequest, 
  ModuleResponse,
  MiddlewareEvent 
} from './types/integration.types';

export class ModuleBridge {
  private endpointRegistry: EndpointRegistry;

  constructor(private eventBus: EventBus) {
    this.endpointRegistry = new EndpointRegistry(eventBus);
    this.setupEventHandlers();
  }

  /**
   * Get the endpoint registry
   */
  getEndpointRegistry(): EndpointRegistry {
    return this.endpointRegistry;
  }

  /**
   * Handle incoming request
   */
  async handleRequest(request: ModuleRequest): Promise<ModuleResponse> {
    const startTime = Date.now();
    
    try {
      // Match endpoint
      const endpoint = this.endpointRegistry.matchEndpoint(request.method, request.path);
      
      if (!endpoint) {
        return {
          error: {
            code: 'NOT_FOUND',
            message: `Endpoint ${request.method} ${request.path} not found`,
            statusCode: 404
          }
        };
      }
      
      // Extract params if needed
      if (!request.params || Object.keys(request.params).length === 0) {
        request.params = this.endpointRegistry.extractParams(request.path, endpoint.path as string);
      }
      
      // Add endpoint info to request
      request.moduleId = endpoint.moduleId;
      request.handler = endpoint.handler;
      
      // Process middleware
      const middlewareResult = await this.processMiddleware(request, endpoint);
      if (middlewareResult) {
        return middlewareResult;
      }
      
      // Check if handler exists
      const hasHandler = await this.checkHandlerExists(endpoint.handler);
      if (!hasHandler) {
        return {
          error: {
            code: 'HANDLER_NOT_FOUND',
            message: `No handler registered for ${endpoint.handler}`,
            statusCode: 500
          }
        };
      }
      
      // Handle request based on type
      if (endpoint.streaming) {
        // Emit the handler event for streaming
        this.eventBus.emit(endpoint.handler, request);
        return { streaming: true };
      }
      
      // Regular request/response
      const timeout = endpoint.timeout || 30000;
      
      try {
        let response = await this.eventBus.emitAndWait(
          endpoint.handler,
          request,
          { timeout }
        );
        
        // Process response middleware
        response = await this.processResponseMiddleware(response, request, endpoint);
        
        // Update stats
        const responseTime = Date.now() - startTime;
        this.endpointRegistry.updateStats(request.path, !response.error, responseTime);
        
        // Emit performance metrics
        this.eventBus.emit(ServerEvents.REQUEST_METRICS, {
          requestId: request.requestId,
          path: request.path,
          method: request.method,
          statusCode: response.error?.statusCode || 200,
          duration: responseTime,
          success: !response.error,
          moduleId: endpoint.moduleId,
          handler: endpoint.handler
        });
        
        return response;
      } catch (error) {
        if (error instanceof Error && error.message.includes('timeout')) {
          return {
            error: {
              code: 'TIMEOUT',
              message: 'Request timeout',
              statusCode: 504
            }
          };
        }
        
        return {
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            statusCode: 500
          }
        };
      }
    } catch (error) {
      return {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: 500
        }
      };
    }
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // Handle endpoint registration
    this.eventBus.on(ServerEvents.REGISTER_ENDPOINTS, (event) => {
      const { moduleId, endpoints } = event;
      
      for (const endpoint of endpoints) {
        try {
          this.endpointRegistry.registerEndpoint({
            ...endpoint,
            moduleId
          });
        } catch (error) {
          this.eventBus.emit(ServerEvents.REGISTRATION_ERROR, {
            moduleId,
            endpoint,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    });
    
    // Handle module shutdown
    this.eventBus.on(ServerEvents.MODULE_SHUTDOWN, (event) => {
      const { moduleId } = event;
      this.endpointRegistry.unregisterModuleEndpoints(moduleId);
    });
  }

  /**
   * Process middleware
   */
  private async processMiddleware(
    request: ModuleRequest, 
    endpoint: EndpointDefinition
  ): Promise<ModuleResponse | null> {
    // Process request middleware
    const requestMiddleware = await this.processPhaseMiddleware('request', request, endpoint);
    if (requestMiddleware) return requestMiddleware;
    
    // Process auth middleware if required
    if (endpoint.auth?.required) {
      const authMiddleware = await this.processAuthMiddleware(request, endpoint);
      if (authMiddleware) return authMiddleware;
    }
    
    // Process response middleware will be handled after response
    
    return null;
  }

  /**
   * Process phase middleware
   */
  private async processPhaseMiddleware(
    phase: string,
    request: ModuleRequest,
    endpoint: EndpointDefinition
  ): Promise<ModuleResponse | null> {
    return new Promise((resolve) => {
      let middlewareHandled = false;
      let middlewareRejected = false;
      let rejectionResponse: ModuleResponse | null = null;
      
      const middlewareEvent = {
        phase,
        request,
        endpoint,
        continue: () => {
          middlewareHandled = true;
          resolve(null);
        },
        reject: (statusCode: number, message: string) => {
          middlewareHandled = true;
          middlewareRejected = true;
          rejectionResponse = {
            error: {
              code: 'MIDDLEWARE_REJECTION',
              message,
              statusCode
            }
          };
          resolve(rejectionResponse);
        }
      };
      
      this.eventBus.emit(ServerEvents.REQUEST_MIDDLEWARE, middlewareEvent);
      
      // If no middleware handlers, continue
      setTimeout(() => {
        if (!middlewareHandled) {
          resolve(null);
        }
      }, 10);
    });
  }

  /**
   * Process auth middleware
   */
  private async processAuthMiddleware(
    request: ModuleRequest,
    endpoint: EndpointDefinition
  ): Promise<ModuleResponse | null> {
    return new Promise((resolve) => {
      let handled = false;
      
      const phases = ['extract', 'validate', 'authorize'];
      let currentPhase = 0;
      
      const processNextPhase = () => {
        if (currentPhase >= phases.length) {
          resolve(null);
          return;
        }
        
        const phase = phases[currentPhase] as 'extract' | 'validate' | 'authorize';
        currentPhase++;
        
        const middlewareEvent: MiddlewareEvent = {
          phase,
          request,
          endpoint,
          token: undefined,
          auth: request.auth,
          continue: () => {
            // Copy auth back to request if modified
            if (middlewareEvent.auth) {
              request.auth = middlewareEvent.auth;
            }
            processNextPhase();
          },
          reject: (statusCode: number, message: string) => {
            handled = true;
            resolve({
              error: {
                code: 'AUTH_FAILED',
                message,
                statusCode
              }
            });
          }
        };
        
        // Let middleware modify the event
        this.eventBus.emit(ServerEvents.AUTH_MIDDLEWARE, middlewareEvent);
        
        // If no handlers, continue
        setTimeout(() => {
          if (!handled) {
            processNextPhase();
          }
        }, 10);
      };
      
      processNextPhase();
    });
  }

  /**
   * Process response middleware
   */
  private async processResponseMiddleware(
    response: ModuleResponse,
    request: ModuleRequest,
    endpoint: EndpointDefinition
  ): Promise<ModuleResponse> {
    return new Promise((resolve) => {
      let middlewareHandled = false;
      
      const middlewareEvent = {
        phase: 'response',
        request,
        endpoint,
        response,
        continue: () => {
          middlewareHandled = true;
          resolve(middlewareEvent.response);
        }
      };
      
      this.eventBus.emit(ServerEvents.RESPONSE_MIDDLEWARE, middlewareEvent);
      
      // If no middleware handlers, continue with original response
      setTimeout(() => {
        if (!middlewareHandled) {
          resolve(response);
        }
      }, 10);
    });
  }

  /**
   * Check if handler exists
   */
  private async checkHandlerExists(handler: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Check if any listeners exist for this event
      const listeners = this.eventBus.listenerCount(handler);
      resolve(listeners > 0);
    });
  }

  /**
   * Get registered endpoints
   */
  getRegisteredEndpoints(): EndpointDefinition[] {
    return this.endpointRegistry.getEndpoints();
  }
}