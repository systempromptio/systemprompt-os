/**
 * Configuration change notification type.
 */
export interface IConfigNotification {
  method: "server/config/changed";
  params: {
    meta: Record<string, unknown>;
    message: string;
    level: "info" | "warning" | "error";
    timestamp: string;
  };
}

/**
 * Progress update notification type.
 */
export interface IProgressNotification {
  method: "notifications/progress";
  params: {
    progressToken: string | number;
    progress: number;
    total?: number;
  };
}

/**
 * Roots list change notification type.
 */
export interface IRootsListChangedNotification {
  method: "notifications/roots/listchanged";
  params?: Record<string, never>;
}

/**
 * Resource update notification type.
 */
export interface IResourcesUpdatedNotification {
  method: "notifications/resources/updated";
  params: {
    uri: string;
  };
}

/**
 * Resources list change notification type.
 */
export interface IResourcesListChangedNotification {
  method: "notifications/resources/listchanged";
  params?: Record<string, never>;
}

/**
 * Options for sending progress notifications.
 */
export interface IProgressNotificationOptions {
  progressToken: string | number;
  progress: number;
  total?: number;
  sessionId?: string;
}

/**
 * Simple progress options interface.
 */
export interface IProgressOptions {
  progressToken: string | number;
  progress: number;
  total?: number;
  sessionId?: string;
}

/**
 * Union type for all notification types.
 */
export type NotificationType =
  | IConfigNotification
  | IProgressNotification
  | IRootsListChangedNotification
  | IResourcesUpdatedNotification
  | IResourcesListChangedNotification;
