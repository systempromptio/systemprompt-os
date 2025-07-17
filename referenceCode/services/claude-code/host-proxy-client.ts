/**
 * @fileoverview Host proxy client for Claude Code service
 * @module services/claude-code/host-proxy-client
 * 
 * @remarks
 * This module provides a TCP client for communicating with the host proxy daemon.
 * The host proxy allows the Docker container to execute Claude commands on the
 * host machine where the actual Claude installation resides. It handles:
 * - Path mapping between Docker and host filesystems
 * - Streaming output from Claude processes
 * - Event parsing and emission
 * - Process lifecycle management
 * 
 * @example
 * ```typescript
 * import { HostProxyClient } from './host-proxy-client';
 * 
 * const client = new HostProxyClient({
 *   host: 'host.docker.internal',
 *   port: 8899
 * });
 * 
 * const result = await client.execute(
 *   'Implement user authentication',
 *   '/workspace/project',
 *   (data) => console.log('Stream:', data)
 * );
 * ```
 */

import * as net from 'net';
import type { HostProxyMessage, HostProxyResponse } from './types.js';
import { 
  HostProxyConnectionError, 
  HostProxyTimeoutError,
  HostProxyError 
} from './errors.js';
import {
  DEFAULT_PROXY_HOST,
  DEFAULT_PROXY_PORT,
  HOST_PROXY_TIMEOUT_MS,
  ENV_VARS
} from './constants.js';
import { logger } from '../../utils/logger.js';
import { ClaudeEventParser } from './event-parser.js';
import {
  ClaudeEvent,
  createProcessStart,
  createProcessEnd
} from '../../types/claude-events.js';

/**
 * Configuration options for the host proxy client
 * 
 * @interface HostProxyConfig
 */
export interface HostProxyConfig {
  /**
   * Host to connect to (defaults to host.docker.internal)
   */
  host?: string;
  
  /**
   * Port to connect to (defaults to 8899)
   */
  port?: number;
  
  /**
   * Connection timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Client for communicating with the host proxy daemon
 * 
 * @class HostProxyClient
 * 
 * @remarks
 * This client establishes TCP connections to the host proxy daemon,
 * sends commands, and handles streaming responses. It also provides
 * event parsing capabilities for detailed process tracking.
 */
export class HostProxyClient {
  private readonly host: string;
  private readonly port: number;
  private readonly timeout: number;
  private eventParser?: ClaudeEventParser;

  /**
   * Creates a new host proxy client
   * 
   * @param config - Configuration options
   */
  constructor(config: HostProxyConfig = {}) {
    this.host = config.host || process.env[ENV_VARS.CLAUDE_PROXY_HOST] || DEFAULT_PROXY_HOST;
    this.port = config.port || parseInt(process.env[ENV_VARS.CLAUDE_PROXY_PORT] || String(DEFAULT_PROXY_PORT), 10);
    this.timeout = config.timeout || HOST_PROXY_TIMEOUT_MS;
  }

  /**
   * Maps Docker paths to host paths
   * 
   * @private
   * @param workingDirectory - The Docker workspace path
   * @returns The mapped host path
   * 
   * @remarks
   * Converts paths from Docker container namespace to host namespace.
   * For example: /workspace -> /var/www/html/systemprompt-coding-agent
   */
  private mapDockerPath(workingDirectory: string): string {
    if (workingDirectory.startsWith('/workspace')) {
      const hostRoot = process.env[ENV_VARS.HOST_FILE_ROOT] || '/var/www/html/systemprompt-coding-agent';
      const mapped = workingDirectory.replace('/workspace', hostRoot);
      logger.info('Mapped Docker path to host', { from: workingDirectory, to: mapped });
      return mapped;
    }
    return workingDirectory;
  }

  /**
   * Executes a command via the host proxy
   * 
   * @param prompt - The prompt to send to Claude
   * @param workingDirectory - The working directory for execution
   * @param onStream - Optional callback for streaming data
   * @param env - Optional environment variables
   * @param sessionId - Optional session ID for event tracking
   * @param taskId - Optional task ID for event tracking
   * @param onEvent - Optional callback for Claude events
   * @returns The complete response from Claude
   * @throws {HostProxyConnectionError} If connection fails
   * @throws {HostProxyTimeoutError} If execution times out
   * @throws {HostProxyError} If host proxy returns an error
   * 
   * @example
   * ```typescript
   * const response = await client.execute(
   *   'Add error handling to the login function',
   *   '/workspace/src',
   *   (data) => process.stdout.write(data),
   *   { DEBUG: 'true' },
   *   'session-123',
   *   'task-456',
   *   (event) => console.log('Event:', event.type)
   * );
   * ```
   */
  async execute(
    prompt: string, 
    workingDirectory: string,
    onStream?: (data: string) => void,
    env?: Record<string, string>,
    sessionId?: string,
    taskId?: string,
    onEvent?: (event: ClaudeEvent) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      logger.info('Connecting to host proxy', { host: this.host, port: this.port });
      
      const hostWorkingDirectory = this.mapDockerPath(workingDirectory);
      const chunks: string[] = [];
      let buffer = '';
      let hasCompleted = false;
      let timeoutId: NodeJS.Timeout;

      if (onEvent && sessionId) {
        this.eventParser = new ClaudeEventParser(sessionId, taskId);
      }
      
      const processStartTime = Date.now();
      
      const client = net.createConnection({ port: this.port, host: this.host }, () => {
        logger.info('Connected to host proxy');
        
        const message: HostProxyMessage = {
          tool: 'claude',
          command: prompt,
          workingDirectory: hostWorkingDirectory,
          env: env
        };
        
        client.write(JSON.stringify(message));
      });

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        client.destroy();
      };

      client.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const response: HostProxyResponse = JSON.parse(line);
              
              switch (response.type) {
                case 'stream':
                  if (response.data) {
                    chunks.push(response.data);
                    onStream?.(response.data);
                    
                    if (this.eventParser && onEvent) {
                      const events = this.eventParser.parseLine(response.data);
                      events.forEach(event => onEvent(event));
                    }
                  }
                  break;
                  
                case 'pid':
                  if (sessionId && onEvent) {
                    const startEvent = createProcessStart(
                      sessionId,
                      response.pid!,
                      prompt,
                      hostWorkingDirectory,
                      taskId,
                      env
                    );
                    onEvent(startEvent);
                  }
                  break;
                  
                case 'error':
                  cleanup();
                  reject(new HostProxyError(response.data || 'Unknown host proxy error'));
                  break;
                  
                case 'complete':
                  hasCompleted = true;
                  
                  let fullOutput = chunks.join('');
                  
                  if (this.eventParser && onEvent) {
                    const { events, output } = this.eventParser.endParsing();
                    events.forEach(event => onEvent(event));
                    fullOutput = output || fullOutput;
                  }
                  
                  if (sessionId && onEvent) {
                    const duration = Date.now() - processStartTime;
                    const endEvent = createProcessEnd(
                      sessionId,
                      response.exitCode ?? 0,
                      null,
                      duration,
                      fullOutput,
                      taskId
                    );
                    onEvent(endEvent);
                  }
                  
                  cleanup();
                  resolve(chunks.join(''));
                  break;
                  
                default:
                  logger.warn('Unknown response type from host proxy', { response });
              }
            } catch (e) {
              logger.error('Failed to parse host proxy response', { error: e, line });
            }
          }
        }
      });

      client.on('error', (err) => {
        if (!hasCompleted) {
          cleanup();
          reject(new HostProxyConnectionError(err.message));
        }
      });

      client.on('close', () => {
        if (!hasCompleted) {
          if (chunks.length > 0) {
            resolve(chunks.join(''));
          } else {
            reject(new HostProxyConnectionError('Connection closed unexpectedly'));
          }
        }
      });

      timeoutId = setTimeout(() => {
        if (!hasCompleted) {
          cleanup();
          reject(new HostProxyTimeoutError(this.timeout));
        }
      }, this.timeout);
    });
  }
}