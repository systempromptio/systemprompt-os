/**
 * @fileoverview Context type definitions for execution environments and permissions
 * @module types/core/context
 */

import { z } from 'zod';
import { SessionId } from './session.js';
import { TaskId } from '../task.js';

/**
 * Comprehensive execution context for agent operations
 * @interface
 */
export interface ExecutionContext {
  /**
   * Session identifier for this execution context
   */
  readonly sessionId: SessionId;
  
  /**
   * Optional task identifier if executing within a task
   */
  readonly taskId?: TaskId;
  
  /**
   * Working directory for file operations
   */
  readonly workingDirectory: string;
  
  /**
   * Environment configuration and variables
   */
  readonly environment: EnvironmentContext;
  
  /**
   * Permission settings for various operations
   */
  readonly permissions: PermissionContext;
  
  /**
   * Resource limits and constraints
   */
  readonly resources: ResourceContext;
  
  /**
   * Distributed tracing identifier
   */
  readonly traceId?: string;
  
  /**
   * Span identifier for distributed tracing
   */
  readonly spanId?: string;
}

/**
 * Environment configuration for execution context
 * @interface
 */
export interface EnvironmentContext {
  /**
   * Environment variables available to the execution
   */
  readonly variables: Record<string, string>;
  
  /**
   * Operating system platform
   */
  readonly platform: NodeJS.Platform;
  
  /**
   * Node.js runtime version
   */
  readonly nodeVersion: string;
  
  /**
   * Timezone for date/time operations
   */
  readonly timezone: string;
  
  /**
   * Locale for internationalization
   */
  readonly locale: string;
}

/**
 * Security permissions for various operations
 * @interface
 */
export interface PermissionContext {
  /**
   * File system access permissions
   */
  readonly fileSystem: FileSystemPermissions;
  
  /**
   * Network access permissions
   */
  readonly network: NetworkPermissions;
  
  /**
   * Process management permissions
   */
  readonly process: ProcessPermissions;
  
  /**
   * Tool usage permissions
   */
  readonly tools: ToolPermissions;
}

/**
 * File system access permissions and restrictions
 * @interface
 */
export interface FileSystemPermissions {
  /**
   * Whether read operations are allowed
   */
  readonly read: boolean;
  
  /**
   * Whether write operations are allowed
   */
  readonly write: boolean;
  
  /**
   * Whether execute operations are allowed
   */
  readonly execute: boolean;
  
  /**
   * Whitelist of allowed file paths (glob patterns supported)
   */
  readonly allowedPaths?: string[];
  
  /**
   * Blacklist of denied file paths (glob patterns supported)
   */
  readonly deniedPaths?: string[];
}

/**
 * Network access permissions and restrictions
 * @interface
 */
export interface NetworkPermissions {
  /**
   * Whether HTTP/HTTPS requests are allowed
   */
  readonly httpRequests: boolean;
  
  /**
   * Whitelist of allowed domains
   */
  readonly allowedDomains?: string[];
  
  /**
   * Blacklist of denied domains
   */
  readonly deniedDomains?: string[];
  
  /**
   * Rate limit for network requests
   */
  readonly maxRequestsPerMinute?: number;
}

/**
 * Process management permissions
 * @interface
 */
export interface ProcessPermissions {
  /**
   * Whether spawning new processes is allowed
   */
  readonly spawn: boolean;
  
  /**
   * Whether killing processes is allowed
   */
  readonly kill: boolean;
  
  /**
   * Whitelist of allowed commands
   */
  readonly allowedCommands?: string[];
  
  /**
   * Blacklist of denied commands
   */
  readonly deniedCommands?: string[];
}

/**
 * Tool usage permissions
 * @interface
 */
export interface ToolPermissions {
  /**
   * Whitelist of allowed tool names
   */
  readonly allowedTools?: string[];
  
  /**
   * Blacklist of denied tool names
   */
  readonly deniedTools?: string[];
  
  /**
   * Whether custom tools can be registered
   */
  readonly customTools?: boolean;
}

/**
 * Resource limits and constraints for execution
 * @interface
 */
export interface ResourceContext {
  /**
   * Memory usage limits
   */
  readonly memory: MemoryLimits;
  
  /**
   * CPU usage limits
   */
  readonly cpu: CPULimits;
  
  /**
   * Storage usage limits
   */
  readonly storage: StorageLimits;
  
  /**
   * Time-based limits
   */
  readonly time: TimeLimits;
}

/**
 * Memory usage limits in bytes
 * @interface
 */
export interface MemoryLimits {
  /**
   * Maximum heap size in bytes
   */
  readonly maxHeapSize?: number;
  
  /**
   * Maximum resident set size in bytes
   */
  readonly maxRssSize?: number;
}

/**
 * CPU usage limits
 * @interface
 */
export interface CPULimits {
  /**
   * Maximum CPU usage percentage (0-100)
   */
  readonly maxCpuPercent?: number;
  
  /**
   * CPU quota in microseconds per period
   */
  readonly cpuQuota?: number;
}

/**
 * Storage usage limits
 * @interface
 */
export interface StorageLimits {
  /**
   * Maximum size for a single file in bytes
   */
  readonly maxFileSize?: number;
  
  /**
   * Maximum total storage size in bytes
   */
  readonly maxTotalSize?: number;
  
  /**
   * Maximum number of files that can be created
   */
  readonly maxFileCount?: number;
}

/**
 * Time-based execution limits
 * @interface
 */
export interface TimeLimits {
  /**
   * Maximum total execution time in milliseconds
   */
  readonly maxExecutionTime?: number;
  
  /**
   * Maximum idle time before termination in milliseconds
   */
  readonly maxIdleTime?: number;
  
  /**
   * General operation timeout in milliseconds
   */
  readonly timeout?: number;
}

/**
 * Context information for incoming requests
 * @interface
 */
export interface RequestContext {
  /**
   * Unique request identifier
   */
  readonly id: string;
  
  /**
   * Request timestamp
   */
  readonly timestamp: Date;
  
  /**
   * Source of the request
   */
  readonly source: 'api' | 'cli' | 'web' | 'internal';
  
  /**
   * User information if authenticated
   */
  readonly user?: UserContext;
  
  /**
   * User session information
   */
  readonly session?: UserSessionContext;
  
  /**
   * Additional request metadata
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * User information for authorization
 * @interface
 */
export interface UserContext {
  /**
   * Unique user identifier
   */
  readonly id: string;
  
  /**
   * User email address
   */
  readonly email?: string;
  
  /**
   * User roles for RBAC
   */
  readonly roles?: string[];
  
  /**
   * Specific permissions granted to user
   */
  readonly permissions?: string[];
}

/**
 * User session information
 * @interface
 */
export interface UserSessionContext {
  /**
   * Unique session identifier
   */
  readonly id: string;
  
  /**
   * Session creation timestamp
   */
  readonly createdAt: Date;
  
  /**
   * Session expiration timestamp
   */
  readonly expiresAt?: Date;
  
  /**
   * Session-specific data
   */
  readonly data?: Record<string, unknown>;
}

/**
 * Zod schema for validating execution context
 */
export const ExecutionContextSchema = z.object({
  sessionId: z.string(),
  taskId: z.string().optional(),
  workingDirectory: z.string(),
  environment: z.object({
    variables: z.record(z.string()),
    platform: z.string(),
    nodeVersion: z.string(),
    timezone: z.string(),
    locale: z.string()
  }),
  permissions: z.object({
    fileSystem: z.object({
      read: z.boolean(),
      write: z.boolean(),
      execute: z.boolean(),
      allowedPaths: z.array(z.string()).optional(),
      deniedPaths: z.array(z.string()).optional()
    }),
    network: z.object({
      httpRequests: z.boolean(),
      allowedDomains: z.array(z.string()).optional(),
      deniedDomains: z.array(z.string()).optional(),
      maxRequestsPerMinute: z.number().optional()
    }),
    process: z.object({
      spawn: z.boolean(),
      kill: z.boolean(),
      allowedCommands: z.array(z.string()).optional(),
      deniedCommands: z.array(z.string()).optional()
    }),
    tools: z.object({
      allowedTools: z.array(z.string()).optional(),
      deniedTools: z.array(z.string()).optional(),
      customTools: z.boolean().optional()
    })
  }),
  resources: z.object({
    memory: z.object({
      maxHeapSize: z.number().optional(),
      maxRssSize: z.number().optional()
    }),
    cpu: z.object({
      maxCpuPercent: z.number().optional(),
      cpuQuota: z.number().optional()
    }),
    storage: z.object({
      maxFileSize: z.number().optional(),
      maxTotalSize: z.number().optional(),
      maxFileCount: z.number().optional()
    }),
    time: z.object({
      maxExecutionTime: z.number().optional(),
      maxIdleTime: z.number().optional(),
      timeout: z.number().optional()
    })
  }),
  traceId: z.string().optional(),
  spanId: z.string().optional()
});