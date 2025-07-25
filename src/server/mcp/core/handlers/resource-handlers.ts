/**
 * @file MCP Resource handlers for agent status and task resources.
 * @module handlers/resource-handlers
 * @remarks
 * This module provides handlers for MCP resource operations including:
 * - Listing available resources (static and dynamic)
 * - Reading resource contents (tasks, logs, status)
 * - Handling resource templates for dynamic URIs
 * @example
 * ```typescript
 * import { handleListResources, handleResourceCall } from './handlers/resource-handlers.js';
 * // List all resources
 * const { resources } = await handleListResources();
 * // Read a specific task
 * const result = await handleResourceCall({
 *   params: { uri: 'task://123' }
 * });
 * ```
 */

import type {
  ListResourcesResult,
  ReadResourceRequest,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import { getModuleLoader } from '@/modules/loader';
/**
 * Lists all available MCP resources including static and dynamic task resources.
 * @returns List of available resources with metadata.
 * @throws {Error} If resource listing fails.
 * @example
 * ```typescript
 * const { resources } = await handleListResources();
 * console.log(`Available resources: ${resources.length}`);
 * ```
 */
export const handleListResources = async function (): Promise<ListResourcesResult> {
  try {
    const moduleLoader = getModuleLoader();
    const resourcesModule = moduleLoader.getModule('resources');

    if (!resourcesModule?.exports) {
      throw new Error('Resources module not available');
    }

    const resources = await resourcesModule.exports.listResources();
    return { resources };
  } catch (error) {
    throw new Error(`Failed to list resources: ${error}`);
  }
}

/**
 * Handles MCP resource read requests for various resource types.
 * @param request - The resource read request with URI.
 * @param extra - Additional context ( unused).
 * @returns Resource content in appropriate format.
 * @throws {Error} If resource is not found or read fails.
 * @remarks
 * Supports multiple resource URI patterns:
 * - `agent://status` - Agent status and capabilities
 * - `task://list` - List of all tasks
 * - `task://[id]` - Individual task details
 * - `task://[id]/logs` - Task logs
 * - `task://[id]/result` - Task result
 * - Various template-based resources
 * @example
 * ```typescript
 * const result = await handleResourceCall({
 *   params: { uri: 'agent://status' }
 * });
 * const status = JSON.parse(result.contents[0].text);
 * ```
 */
export const handleResourceCall = async function (
  request: ReadResourceRequest,
): Promise<ReadResourceResult> {
  try {
    const moduleLoader = getModuleLoader();
    const resourcesModule = moduleLoader.getModule('resources');

    if (!resourcesModule?.exports) {
      throw new Error('Resources module not available');
    }

    const resourceWithContents = await resourcesModule.exports.getResource(request.params.uri);
    if (!resourceWithContents) {
      throw new Error(`Resource not found: ${request.params.uri}`);
    }

    return {
      contents: resourceWithContents.contents,
    };
  } catch (error) {
    throw new Error(`Failed to read resource: ${error}`);
  }
}
