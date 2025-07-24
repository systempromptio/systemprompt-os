/**
 * @fileoverview MCP notification handlers for sending various notification types
 * @module handlers/notifications
 * 
 * @remarks
 * This module provides functions for sending different types of MCP notifications:
 * - Operation notifications (task updates)
 * - Configuration change notifications
 * - Progress notifications
 * - Resource update notifications
 * - Roots list change notifications
 * 
 * Notifications can be sent to specific sessions or broadcast to all active sessions.
 * 
 * @example
 * ```typescript
 * import { sendOperationNotification, sendProgressNotification } from './handlers/notifications.js';
 * 
 * // Send operation notification
 * await sendOperationNotification('createtask', 'Task created successfully');
 * 
 * // Send progress notification
 * await sendProgressNotification('task-123', 50, 100, 'session-456');
 * ```
 */

import type { ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { getMCPHandlerInstance } from '../../../mcp.js';


/**
 * Configuration change notification type
 */
type ConfigNotification = {
  method: "server/config/changed";
  params: {
    meta: Record<string, unknown>;
    message: string;
    level: "info" | "warning" | "error";
    timestamp: string;
  };
};

/**
 * Progress update notification type
 */
type ProgressNotification = {
  method: "notifications/progress";
  params: {
    progressToken: string | number;
    progress: number;
    total?: number;
  };
};

/**
 * Roots list change notification type
 */
type RootsListChangedNotification = {
  method: "notifications/roots/listchanged";
  params?: Record<string, never>;
};

/**
 * Resource update notification type
 */
type ResourcesUpdatedNotification = {
  method: "notifications/resources/updated";
  params: {
    uri: string;
  };
};

/**
 * Resources list change notification type
 */
type ResourcesListChangedNotification = {
  method: "notifications/resources/listchanged";
  params?: Record<string, never>;
};

/**
 * Sends an operation notification for task-related events
 * 
 * @param operation - The operation type (e.g., 'createtask', 'updatetask')
 * @param message - The notification message
 * @param sessionId - Optional session ID for targeted notification
 * 
 * @example
 * ```typescript
 * await sendOperationNotification('endtask', 'Task completed successfully', 'session-123');
 * ```
 */
export async function sendOperationNotification( operation: string, message: string, sessionId?: string): Promise<void> {
  const notification: ServerNotification = {
    method: "notifications/message",
    params: {
      meta: {},
      message: `Operation ${operation}: ${message}`,
      level: "info",
      timestamp: new Date().toISOString(),
    },
  };
  await sendNotification(notification, sessionId);
}

/**
 * Sends a JSON result notification
 * 
 * @param message - The notification message
 */
export async function sendJsonResultNotification( message: string): Promise<void> {
  const notification: ServerNotification = {
    method: "notifications/message",
    params: {
      meta: {},
      message: message,
      level: "info",
      timestamp: new Date().toISOString(),
    },
  };
  await sendNotification( notification);
}


/**
 * Sends a configuration change notification
 * 
 * @param message - The configuration change message
 */
export async function sendConfigNotification( message: string): Promise<void> {
  const notification: ConfigNotification = {
    method: "server/config/changed",
    params: {
      meta: {},
      message: message,
      level: "info",
      timestamp: new Date().toISOString(),
    },
  };
  await sendNotification( notification);
}

/**
 * Sends a progress update notification
 * 
 * @param progressToken - Unique token identifying the operation
 * @param progress - Current progress value
 * @param total - Optional total value for percentage calculation
 * @param sessionId - Optional session ID for targeted notification
 * 
 * @example
 * ```typescript
 * await sendProgressNotification('task-123', 75, 100, 'session-456');
 * ```
 */
export async function sendProgressNotification(
  progressToken: string | number,
  progress: number,
  total?: number,
  sessionId?: string
): Promise<void> {
  const notification: ProgressNotification = {
    method: "notifications/progress",
    params: {
      progressToken,
      progress,
      ...(total !== undefined && { total }),
    },
  };
  await sendNotification(notification, sessionId);
}

/**
 * Sends a notification that the roots list has changed
 * 
 */
export async function sendRootsListChangedNotification(): Promise<void> {
  const notification: RootsListChangedNotification = {
    method: "notifications/roots/listchanged",
    params: {}
  };
  await sendNotification( notification);
}

/**
 * Sends a notification that a specific resource has been updated
 * 
 * @param uri - The URI of the updated resource
 * @param sessionId - Optional session ID for targeted notification
 * 
 * @example
 * ```typescript
 * await sendResourcesUpdatedNotification('task://123', 'session-789');
 * ```
 */
export async function sendResourcesUpdatedNotification( uri: string, sessionId?: string): Promise<void> {
  const notification: ResourcesUpdatedNotification = {
    method: "notifications/resources/updated",
    params: { uri }
  };
  await sendNotification(notification, sessionId);
}

/**
 * Sends a notification that the resources list has changed
 * 
 * @param sessionId - Optional session ID for targeted notification
 */
export async function sendResourcesListChangedNotification(sessionId?: string): Promise<void> {
  const notification: ResourcesListChangedNotification = {
    method: "notifications/resources/listchanged",
    params: {}
  };
  await sendNotification(notification, sessionId);
}

/**
 * Internal function to send notifications to MCP clients
 * 
 * @param notification - The notification to send
 * @param sessionId - Optional session ID for targeted notification
 * 
 * @remarks
 * This function handles both targeted (session-specific) and broadcast
 * notifications. If sessionId is provided, the notification is sent only
 * to that session. Otherwise, it's broadcast to all active sessions.
 */
async function sendNotification(
  notification: ServerNotification | ConfigNotification | ProgressNotification | RootsListChangedNotification | ResourcesUpdatedNotification | ResourcesListChangedNotification,
  sessionId?: string
) {
  const handler = getMCPHandlerInstance();
  if (!handler) {
    return;
  }

  if ( sessionId) {
    const server = handler.getServerForSession( sessionId);
    if (!server) {
      return;
    }
    
    try {
      await server.notification(notification as ServerNotification);
    } catch ( err) {
      const error = err instanceof Error ? err : new Error(String( err));
      throw error;
    }
    return;
  }
  
  const activeServers = handler.getAllServers();
  if (activeServers.length === 0) {
    return;
  }
  
  
  const notificationPromises = activeServers.map(async ( server: Server) => 
    server.notification(notification as ServerNotification).catch(() => {
      // Ignore broadcast failures silently
    })
  );
  
  await Promise.all( notificationPromises);
}

