/**
 * Endpoint Registry.
 * Manages dynamic endpoint registration for all protocols.
 */

import type { EventBus } from '../core/services/event-bus.service';
import type { HttpEndpoint } from '../protocols/http/types/http.types';

export interface EndpointStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalResponseTime: number;
  averageResponseTime: number;
}

export class EndpointRegistry {
  private endpoints: HttpEndpoint[] = [];
  private readonly endpointStats: Map<string, EndpointStats> = new Map();

  constructor(private readonly eventBus: EventBus) {}

  /**
   * Register an endpoint.
   * @param endpoint
   */
  registerEndpoint(endpoint: HttpEndpoint): void {
    const conflict = this.endpoints.find(e =>
      { return e.method === endpoint.method
      && e.path === endpoint.path
      && e.protocol === endpoint.protocol });

    if (conflict) {
      throw new Error(
        `Endpoint conflict: ${endpoint.method} ${endpoint.path} already registered by ${conflict.moduleId}`
      );
    }

    this.endpoints.push(endpoint);
  }

  /**
   * Match request to endpoint.
   * @param method
   * @param path
   */
  matchEndpoint(method: string, path: string): HttpEndpoint | null {
    for (const endpoint of this.endpoints) {
      if (endpoint.method !== method) { continue; }

      if (typeof endpoint.path === 'string') {
        if (this.matchPath(path, endpoint.path)) {
          return endpoint;
        }
      } else if (endpoint.path instanceof RegExp) {
        if (endpoint.path.test(path)) {
          return endpoint;
        }
      }
    }

    return null;
  }

  /**
   * Match path with params.
   * @param requestPath
   * @param endpointPath
   */
  private matchPath(requestPath: string, endpointPath: string): boolean {
    // Handle wildcard paths
    if (endpointPath.includes('*')) {
      const wildcardPattern = endpointPath
        .replace(/\*/g, '.*')  // Replace * with regex wildcard
        .replace(/:([^/]+)/g, '([^/]+)');  // Replace params
      const regex = new RegExp(`^${wildcardPattern}$`);
      return regex.test(requestPath);
    }

    // Handle regular paths with params
    const paramRegex = /:([^/]+)/g;
    const regexPattern = endpointPath.replace(paramRegex, '([^/]+)');
    const regex = new RegExp(`^${regexPattern}$`);

    return regex.test(requestPath);
  }

  /**
   * Extract params from path.
   * @param requestPath
   * @param endpointPath
   */
  extractParams(requestPath: string, endpointPath: string): Record<string, string> {
    const params: Record<string, string> = {};

    if (typeof endpointPath !== 'string') { return params; }

    const paramNames: string[] = [];
    const paramRegex = /:([^/]+)/g;
    let match;

    while ((match = paramRegex.exec(endpointPath)) !== null) {
      paramNames.push(match[1]);
    }

    const regexPattern = endpointPath.replace(/:([^/]+)/g, '([^/]+)');
    const regex = new RegExp(`^${regexPattern}$`);
    const matches = requestPath.match(regex);

    if (matches) {
      paramNames.forEach((name, index) => {
        params[name] = matches[index + 1];
      });
    }

    return params;
  }

  /**
   * Get all endpoints.
   */
  getEndpoints(): HttpEndpoint[] {
    return [...this.endpoints];
  }

  /**
   * Unregister all endpoints for a module.
   * @param moduleId
   */
  unregisterModuleEndpoints(moduleId: string): void {
    this.endpoints = this.endpoints.filter(e => { return e.moduleId !== moduleId });
  }

  /**
   * Update endpoint stats.
   * @param path
   * @param success
   * @param responseTime
   */
  updateStats(path: string, success: boolean, responseTime: number): void {
    const key = path;
    const stats = this.endpointStats.get(key) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      averageResponseTime: 0
    };

    stats.totalRequests++;
    if (success) {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
    }
    stats.totalResponseTime += responseTime;
    stats.averageResponseTime = stats.totalResponseTime / stats.totalRequests;

    this.endpointStats.set(key, stats);
  }

  /**
   * Get endpoint stats.
   * @param path
   */
  getEndpointStats(path: string): EndpointStats | undefined {
    return this.endpointStats.get(path);
  }
}
