/**
 * MCP notification handlers for sending various notification types.
 * @file MCP notification handlers for sending various notification types.
 * @module handlers/notifications
 * This module provides functions for sending different types of MCP notifications:
 * - Operation notifications (task updates)
 * - Configuration change notifications
 * - Progress notifications
 * - Resource update notifications
 * - Roots list change notifications
 * Notifications can be sent to specific sessions or broadcast to all active sessions.
 * @example
 * ```typescript
 * import {
 * sendOperationNotification,
 * sendProgressNotification
 * } from './handlers/notifications.js';
 * // Send operation notification
 * await sendOperationNotification('createtask', 'Task created successfully');
 * // Send progress notification
 * await sendProgressNotification('task-123', 50, 100, 'session-456');
 * ```
 */

import type { ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { getMcpHandlerInstance } from '@/server/mcp';
import type {
  IConfigNotification,
  IProgressNotification,
  IProgressOptions,
  IResourcesListChangedNotification,
  IResourcesUpdatedNotification,
  IRootsListChangedNotification,
  NotificationType,
} from '@/server/mcp/core/handlers/types/notifications.types';

/**
 * Helper function to broadcast notification to all servers.
 * @param notification - The notification to send.
 * @param activeServers - Array of active servers.
 */
const broadcastToServers = async (
  notification: NotificationType | ServerNotification,
  activeServers: Server[],
): Promise<void> => {
  const promises = activeServers.map(
    async (server: Server): Promise<void> => {
      await server.notification(notification)
        .catch((error: unknown): void => {
          if (error instanceof Error) {
            throw error;
          }
        });
    },
  );

  await Promise.all(promises);
};

/**
 * Helper to send notification to a specific session.
 * @param notification - The notification to send.
 * @param sessionId - Session ID for targeted notification.
 * @param handler - MCP handler instance.
 */
const sendToSession = async (
  notification: NotificationType | ServerNotification,
  sessionId: string,
  handler: ReturnType<typeof getMcpHandlerInstance>,
): Promise<void> => {
  const server = handler?.getServerForSession(sessionId);
  if (server === null || server === undefined) {
    return;
  }

  try {
    await server.notification(notification);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    throw error;
  }
};

/**
 * Internal function to send notifications to MCP clients.
 * @param notification - The notification to send.
 * @param sessionId - Optional session ID for targeted notification.
 * @description
 * This function handles both targeted and broadcast notifications.
 */
const sendNotification = async function sendNotification(
  notification: NotificationType | ServerNotification,
  sessionId?: string,
): Promise<void> {
  const handler = getMcpHandlerInstance();
  if (handler === null) {
    return;
  }

  if (sessionId !== null && sessionId !== undefined) {
    await sendToSession(notification, sessionId, handler);
    return;
  }

  const activeServers = handler.getAllServers();
  if (activeServers.length === 0) {
    return;
  }

  await broadcastToServers(notification, activeServers);
};

/**
 * Sends an operation notification for task-related events.
 * @param operation - The operation type (e.g., 'createtask', 'updatetask').
 * @param message - The notification message.
 * @param sessionId - Optional session ID for targeted notification.
 * @example
 * ```typescript
 * await sendOperationNotification('endtask', 'Task completed successfully', 'session-123');
 * ```
 */
export const sendOperationNotification = async function sendOperationNotification(
  operation: string,
  message: string,
  sessionId?: string,
): Promise<void> {
  const notification: ServerNotification = {
    method: 'notifications/message',
    params: {
      meta: {},
      message: `Operation ${operation}: ${message}`,
      level: 'info',
      timestamp: new Date().toISOString(),
    },
  };
  await sendNotification(notification, sessionId);
};

/**
 * Sends a JSON result notification.
 * @param message - The notification message.
 */
export const sendJsonResultNotification = async function sendJsonResultNotification(
  message: string,
): Promise<void> {
  const notification: ServerNotification = {
    method: 'notifications/message',
    params: {
      meta: {},
      message,
      level: 'info',
      timestamp: new Date().toISOString(),
    },
  };
  await sendNotification(notification);
};

/**
 * Sends a configuration change notification.
 * @param message - The configuration change message.
 */
export const sendConfigNotification = async function sendConfigNotification(
  message: string,
): Promise<void> {
  const notification: IConfigNotification = {
    method: 'server/config/changed',
    params: {
      meta: {},
      message,
      level: 'info',
      timestamp: new Date().toISOString(),
    },
  };
  await sendNotification(notification);
};

/**
 * Sends a progress update notification.
 * @param options - Progress notification options.
 * @example
 * ```typescript
 * await sendProgressNotification({
 *   progressToken: 'task-123',
 *   progress: 75,
 *   total: 100,
 *   sessionId: 'session-456'
 * });
 * ```
 */
export const sendProgressNotification = async function sendProgressNotification(
  options: IProgressOptions,
): Promise<void> {
  const {
 progressToken, progress, total, sessionId
} = options;
  const notification: IProgressNotification = {
    method: 'notifications/progress',
    params: {
      progressToken,
      progress,
      ...total !== undefined && { total },
    },
  };
  await sendNotification(notification, sessionId);
};

/**
 * Sends a notification that the roots list has changed.
 */
export const sendRootsNotification = async function sendRootsNotification(): Promise<void> {
  const notification: IRootsListChangedNotification = {
    method: 'notifications/roots/listchanged',
    params: {},
  };
  await sendNotification(notification);
};

/**
 * Sends a notification that a specific resource has been updated.
 * @param uri - The URI of the updated resource.
 * @param sessionId - Optional session ID for targeted notification.
 * @example
 * ```typescript
 * await sendResourceNotification('task://123', 'session-789');
 * ```
 */
export const sendResourceNotification = async function sendResourceNotification(
  uri: string,
  sessionId?: string,
): Promise<void> {
  const notification: IResourcesUpdatedNotification = {
    method: 'notifications/resources/updated',
    params: { uri },
  };
  await sendNotification(notification, sessionId);
};

/**
 * Sends a notification that the resources list has changed.
 * @param sessionId - Optional session ID for targeted notification.
 */
export const sendResourcesNotification = async function sendResourcesNotification(
  sessionId?: string,
): Promise<void> {
  const notification: IResourcesListChangedNotification = {
    method: 'notifications/resources/listchanged',
    params: {},
  };
  await sendNotification(notification, sessionId);
};
