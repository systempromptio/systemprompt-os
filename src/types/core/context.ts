/**
 * @fileoverview Context type definitions for execution environments and permissions
 * @module types/core/context
 * @since 1.0.0
 */

import { z } from 'zod';
import { SessionId } from './session.js';
import { TaskId } from '../task.js';

/**
 * Comprehensive execution context for agent operations
 * @interface
 * @since 1.0.0
 */
export interface ExecutionContext {
  /**
   * Session identifier for this execution context
   * @since 1.0.0
   */
  readonly sessionId: SessionId;
  
  /**
   * Optional task identifier if executing within a task
   * @since 1.0.0
   */
  readonly taskId?: TaskId;
  
  /**
   * Working directory for file operations
   * @since 1.0.0
   */
  readonly workingDirectory: string;
  
  /**
   * Environment configuration and variables
   * @since 1.0.0
   */
  readonly environment: EnvironmentContext;
  
  /**
   * Permission settings for various operations
   * @since 1.0.0
   */
  readonly permissions: PermissionContext;
  
  /**
   * Resource limits and constraints
   * @since 1.0.0
   */
  readonly resources: ResourceContext;
  
  /**
   * Distributed tracing identifier
   * @since 1.0.0
   */
  readonly traceId?: string;
  
  /**
   * Span identifier for distributed tracing
   * @since 1.0.0
   */
  readonly spanId?: string;
}

/**
 * Environment configuration for execution context
 * @interface
 * @since 1.0.0
 */
export interface EnvironmentContext {
  /**
   * Environment variables available to the execution
   * @since 1.0.0
   */
  readonly variables: Record<string, string>;
  
  /**
   * Operating system platform
   * @since 1.0.0
   */
  readonly platform: NodeJS.Platform;
  
  /**
   * Node.js runtime version
   * @since 1.0.0
   */
  readonly nodeVersion: string;
  
  /**
   * Timezone for date/time operations
   * @since 1.0.0
   */
  readonly timezone: string;
  
  /**
   * Locale for internationalization
   * @since 1.0.0
   */
  readonly locale: string;
}

/**
 * Security permissions for various operations
 * @interface
 * @since 1.0.0
 */
export interface PermissionContext {
  /**
   * File system access permissions
   * @since 1.0.0
   */
  readonly fileSystem: FileSystemPermissions;
  
  /**
   * Network access permissions
   * @since 1.0.0
   */
  readonly network: NetworkPermissions;
  
  /**
   * Process management permissions
   * @since 1.0.0
   */
  readonly process: ProcessPermissions;
  
  /**
   * Tool usage permissions
   * @since 1.0.0
   */
  readonly tools: ToolPermissions;
}

/**
 * File system access permissions and restrictions
 * @interface
 * @since 1.0.0
 */
export interface FileSystemPermissions {
  /**
   * Whether read operations are allowed
   * @since 1.0.0
   */
  readonly read: boolean;
  
  /**
   * Whether write operations are allowed
   * @since 1.0.0
   */
  readonly write: boolean;
  
  /**
   * Whether execute operations are allowed
   * @since 1.0.0
   */
  readonly execute: boolean;
  
  /**
   * Whitelist of allowed file paths (glob patterns supported)
   * @since 1.0.0
   */
  readonly allowedPaths?: string[];
  
  /**
   * Blacklist of denied file paths (glob patterns supported)
   * @since 1.0.0
   */
  readonly deniedPaths?: string[];
}

/**
 * Network access permissions and restrictions
 * @interface
 * @since 1.0.0
 */
export interface NetworkPermissions {
  /**
   * Whether HTTP/HTTPS requests are allowed
   * @since 1.0.0
   */
  readonly httpRequests: boolean;
  
  /**
   * Whitelist of allowed domains
   * @since 1.0.0
   */
  readonly allowedDomains?: string[];
  
  /**
   * Blacklist of denied domains
   * @since 1.0.0
   */
  readonly deniedDomains?: string[];
  
  /**
   * Rate limit for network requests
   * @since 1.0.0
   */
  readonly maxRequestsPerMinute?: number;
}

/**
 * Process management permissions
 * @interface
 * @since 1.0.0
 */
export interface ProcessPermissions {
  /**
   * Whether spawning new processes is allowed
   * @since 1.0.0
   */
  readonly spawn: boolean;
  
  /**
   * Whether killing processes is allowed
   * @since 1.0.0
   */
  readonly kill: boolean;
  
  /**
   * Whitelist of allowed commands
   * @since 1.0.0
   */
  readonly allowedCommands?: string[];
  
  /**
   * Blacklist of denied commands
   * @since 1.0.0
   */
  readonly deniedCommands?: string[];
}

/**
 * Tool usage permissions
 * @interface
 * @since 1.0.0
 */
export interface ToolPermissions {
  /**
   * Whitelist of allowed tool names
   * @since 1.0.0
   */
  readonly allowedTools?: string[];
  
  /**
   * Blacklist of denied tool names
   * @since 1.0.0
   */
  readonly deniedTools?: string[];
  
  /**
   * Whether custom tools can be registered
   * @since 1.0.0
   */
  readonly customTools?: boolean;
}

/**
 * Resource limits and constraints for execution
 * @interface
 * @since 1.0.0
 */
export interface ResourceContext {
  /**
   * Memory usage limits
   * @since 1.0.0
   */
  readonly memory: MemoryLimits;
  
  /**
   * CPU usage limits
   * @since 1.0.0
   */
  readonly cpu: CPULimits;
  
  /**
   * Storage usage limits
   * @since 1.0.0
   */
  readonly storage: StorageLimits;
  
  /**
   * Time-based limits
   * @since 1.0.0
   */
  readonly time: TimeLimits;
}

/**
 * Memory usage limits in bytes
 * @interface
 * @since 1.0.0
 */
export interface MemoryLimits {
  /**
   * Maximum heap size in bytes
   * @since 1.0.0
   */
  readonly maxHeapSize?: number;
  
  /**
   * Maximum resident set size in bytes
   * @since 1.0.0
   */
  readonly maxRssSize?: number;
}

/**
 * CPU usage limits
 * @interface
 * @since 1.0.0
 */
export interface CPULimits {
  /**
   * Maximum CPU usage percentage (0-100)
   * @since 1.0.0
   */
  readonly maxCpuPercent?: number;
  
  /**
   * CPU quota in microseconds per period
   * @since 1.0.0
   */
  readonly cpuQuota?: number;
}

/**
 * Storage usage limits
 * @interface
 * @since 1.0.0
 */
export interface StorageLimits {
  /**
   * Maximum size for a single file in bytes
   * @since 1.0.0
   */
  readonly maxFileSize?: number;
  
  /**
   * Maximum total storage size in bytes
   * @since 1.0.0
   */
  readonly maxTotalSize?: number;
  
  /**
   * Maximum number of files that can be created
   * @since 1.0.0
   */
  readonly maxFileCount?: number;
}

/**
 * Time-based execution limits
 * @interface
 * @since 1.0.0
 */
export interface TimeLimits {
  /**
   * Maximum total execution time in milliseconds
   * @since 1.0.0
   */
  readonly maxExecutionTime?: number;
  
  /**
   * Maximum idle time before termination in milliseconds
   * @since 1.0.0
   */
  readonly maxIdleTime?: number;
  
  /**
   * General operation timeout in milliseconds
   * @since 1.0.0
   */
  readonly timeout?: number;
}

/**
 * Context information for incoming requests
 * @interface
 * @since 1.0.0
 */
export interface RequestContext {
  /**
   * Unique request identifier
   * @since 1.0.0
   */
  readonly id: string;
  
  /**
   * Request timestamp
   * @since 1.0.0
   */
  readonly timestamp: Date;
  
  /**
   * Source of the request
   * @since 1.0.0
   */
  readonly source: 'api' | 'cli' | 'web' | 'internal';
  
  /**
   * User information if authenticated
   * @since 1.0.0
   */
  readonly user?: UserContext;
  
  /**
   * User session information
   * @since 1.0.0
   */
  readonly session?: UserSessionContext;
  
  /**
   * Additional request metadata
   * @since 1.0.0
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * User information for authorization
 * @interface
 * @since 1.0.0
 */
export interface UserContext {
  /**
   * Unique user identifier
   * @since 1.0.0
   */
  readonly id: string;
  
  /**
   * User email address
   * @since 1.0.0
   */
  readonly email?: string;
  
  /**
   * User roles for RBAC
   * @since 1.0.0
   */
  readonly roles?: string[];
  
  /**
   * Specific permissions granted to user
   * @since 1.0.0
   */
  readonly permissions?: string[];
}

/**
 * User session information
 * @interface
 * @since 1.0.0
 */
export interface UserSessionContext {
  /**
   * Unique session identifier
   * @since 1.0.0
   */
  readonly id: string;
  
  /**
   * Session creation timestamp
   * @since 1.0.0
   */
  readonly createdAt: Date;
  
  /**
   * Session expiration timestamp
   * @since 1.0.0
   */
  readonly expiresAt?: Date;
  
  /**
   * Session-specific data
   * @since 1.0.0
   */
  readonly data?: Record<string, unknown>;
}

/**
 * Zod schema for validating execution context
 * @since 1.0.0
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