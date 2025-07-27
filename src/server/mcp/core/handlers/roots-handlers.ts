/**
 * MCP Roots handlers for filesystem access boundaries.
 * @file MCP Roots handlers for filesystem access boundaries.
 * @module handlers/roots-handlers
 * This module implements the roots functionality from the MCP specification.
 * Roots define filesystem boundaries that the daemon has access to on the host machine.
 * The daemon runs on the host machine (not in Docker) and has access to:
 * 1. The main project directory ( HOST_FILE_ROOT)
 * 2. Additional project directories ( PROJECTS_PATH)
 * 3. The user's home directory for configuration files
 * 4. Temporary directories for intermediate operations
 * These roots represent the actual host filesystem paths, not Docker container paths.
 * @example
 * ```typescript
 * import { handleListRoots, notifyRootsChanged } from './handlers/roots-handlers.js';
 * // List available roots
 * const { roots } = await handleListRoots({});
 * // Notify clients of roots change
 * await notifyRootsChanged();
 * ```
 */

import type {
 ListRootsRequest, ListRootsResult, Root
} from '@modelcontextprotocol/sdk/types.js';
import { LogSource, LoggerService } from '@/modules/core/logger/index';
import { sendRootsListChangedNotification } from '@/server/mcp/core/handlers/notifications';

const logger = LoggerService.getInstance();
import * as path from 'path';
import * as os from 'os';

/**
 * Gets the server roots dynamically based on environment configuration.
 * @returns Array of root directories accessible to the daemon.
 * These represent the actual host directories that the daemon has access to.
 * The roots are calculated dynamically based on environment variables.
 */
function getServerRoots(): Root[] {
  const roots: Root[] = [];

  const hostFileRoot = process.env.HOSTFILE_ROOT ?? '/var/www/html/systemprompt-coding-agent';
  roots.push({
    uri: `file://${hostFileRoot}`,
    name: 'Main Project Root (Working Directory)',
  });

  const { PROJECTSPATH: projectsPath } = process.env;
  if (projectsPath != null && projectsPath !== '' && !projectsPath.startsWith('./')) {
    roots.push({
      uri: `file://${projectsPath}`,
      name: 'Additional Projects Directory',
    });
  } else if (projectsPath != null && projectsPath !== '') {
    const absoluteProjectsPath = path.resolve(hostFileRoot, projectsPath);
    roots.push({
      uri: `file://${absoluteProjectsPath}`,
      name: 'Additional Projects Directory',
    });
  }

  const homeDir = process.env.HOME ?? os.homedir();
  roots.push({
    uri: `file://${homeDir}`,
    name: 'User Home Directory',
  });

  roots.push({
    uri: 'file:///tmp',
    name: 'Temporary Files',
  });

  roots.push({
    uri: 'file:///usr/local',
    name: 'System Local Directory',
  });

  return roots;
}

/**
 * Handles MCP roots/list requests.
 * @param request - The list roots request (unused).
 * @param _request
 * @returns List of available filesystem roots.
 * Returns the list of filesystem roots that the daemon has access to on the host.
 * These are the actual host filesystem paths, not Docker container paths.
 * The daemon runs on the host and can access these directories directly.
 * @example
 * ```typescript
 * const result = await handleListRoots({});
 * console.log(`Available roots: ${result.roots.length}`);
 * ```
 */
export async function handleListRoots(_request: ListRootsRequest): Promise<ListRootsResult> {
  const roots = getServerRoots();

  logger.debug(LogSource.MCP, '📁 Listing roots (host filesystem paths)', {
    rootCount: roots.length,
    roots: roots.map((root): { uri: string; name: string | undefined } => { return {
      uri: root.uri,
      name: root.name
    } }),
  });

  return {
    roots,
  };
}

/**
 * Gets current roots for notifications.
 * @returns The dynamically calculated roots based on current environment.
 */
export function getCurrentRoots(): Root[] {
  return getServerRoots();
}

/**
 * Notifies clients about roots changes.
 * Since roots are calculated dynamically from environment variables,
 * this function just sends a notification that roots may have changed.
 * Clients will re-fetch the roots list to get the updated values.
 * @example
 * ```typescript
 * // After environment change
 * await notifyRootsChanged();
 * ```
 */
export async function notifyRootsChanged(): Promise<void> {
  logger.info(LogSource.MCP, '🔄 Notifying clients about roots change');

  try {
    await sendRootsListChangedNotification();
    logger.debug(LogSource.MCP, '📡 Sent roots/listchanged notification');
  } catch (error) {
    logger.error(LogSource.MCP, 'Failed to send roots changed notification', {
      error: error instanceof Error ? error : new Error(String(error))
    });
  }
}
